import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import userModel from "../models/user.model.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import fs from "fs";
import AppError from "../utils/error.utils.js";
import sendEmail from "../utils/sendEmail.js";
import dotenv from 'dotenv';
dotenv.config();

// Configure AWS SDK for DigitalOcean Spaces
const s3Client = new S3Client({
  endpoint: "https://blr1.digitaloceanspaces.com", // DigitalOcean Spaces endpoint
  region: "blr1", // Your Spaces region
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY, // Access key
    secretAccessKey: process.env.DO_SPACES_SECRET, // Secret key
  },
});



// Utility function to upload to Spaces
const uploadToSpaces = async (filePath, fileName) => {
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket:process.env.DO_SPACES_BUCKET, // Your bucket name
    Key: fileName, // File name to save in Spaces
    Body: fileContent,
    ACL: 'public-read', // Make it publicly readable
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);

  return {
    Location: `https://${process.env.DO_SPACES_BUCKET}.blr1.digitaloceanspaces.com/${fileName}`,
    Key: fileName,
  };
};

// Utility function to delete from Spaces
const deleteFromSpaces = async (fileName) => {
  const params = {
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: fileName,
  };

  const command = new DeleteObjectCommand(params);
  await s3Client.send(command);
};


// Cookie options
const cookieOptions = {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  secure: process.env.NODE_ENV === "production", // Use secure cookies only in production
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Adjust for cross-site cookies in production
};

// Register
const register = async (req, res, next) => {
  try {
    const { fullName, email, password ,category} = req.body;

    if (!fullName || !email || !password) {
      return next(new AppError("All fields are required", 400));
    }

    const user = await userModel.create({
      fullName,
      email,
      password,
      category,
      avatar: {
        public_id: email,
        secure_url: "",
      },
    });

    if (req.file) {
      const fileName = `Learning-Management-System/avatars/${Date.now()}-${req.file.filename}`;
      const uploadResult = await uploadToSpaces(req.file.path, fileName);

      user.avatar.public_id = fileName;
      user.avatar.secure_url = uploadResult.Location;
      user.category=category

      fs.rmSync(req.file.path); // Remove file from server
    }

    await user.save();

    user.password = undefined;

    const token = await user.generateJWTToken();

    res.cookie("token", token, cookieOptions);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
    });
  } catch (e) {
    console.log(e);
    return next(new AppError(e.message, 500));
  }
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("All fields are required", 400));
    }

    const user = await userModel.findOne({ email }).select("+password");

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return next(new AppError("Email or Password does not match", 400));
    }

    const token = await user.generateJWTToken();

    user.password = undefined;

    res.cookie("token", token, cookieOptions);

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user,
    });
  } catch (e) {
    console.log(e);
    return next(new AppError(e.message, 500));
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    res.cookie("token", null, {
      secure: true,
      maxAge: 0,
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Get Profile
const getProfile = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await userModel.findById(id);

    res.status(200).json({
      success: true,
      message: "User details",
      user,
    });
  } catch (e) {
    return next(new AppError("Failed to fetch user profile", 500));
  }
};

// Forgot Password
const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Email is required", 400));
  }

  const user = await userModel.findOne({ email });

  if (!user) {
    return next(new AppError("Email not registered", 400));
  }

  const resetToken = await user.generatePasswordResetToken();

  await user.save();

  const resetPasswordURL = `${process.env.CLIENT_URL}/user/profile/reset-password/${resetToken}`;

  const subject = "Reset Password";
  const message = `You can reset your password by clicking ${resetPasswordURL} Reset your password.\nIf the above link does not work, copy and paste this link in a new tab: ${resetPasswordURL}.\n If you did not request this, kindly ignore.`;

  try {
    await sendEmail(email, subject, message);

    res.status(200).json({
      success: true,
      message: `Reset password token has been sent to ${email}`,
    });
  } catch (e) {
    user.forgotPasswordExpiry = undefined;
    user.forgotPasswordToken = undefined;
    await user.save();
    return next(new AppError(e.message, 500));
  }
};

// Reset Password
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    const forgotPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await userModel.findOne({
      forgotPasswordToken,
      forgotPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError("Token is invalid or expired, please try again", 400));
    }

    user.password = password;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Change Password
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { id } = req.user;

    if (!oldPassword || !newPassword) {
      return next(new AppError("All fields are required", 400));
    }

    const user = await userModel.findById(id).select("+password");

    if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
      return next(new AppError("Invalid Old Password", 400));
    }

    user.password = newPassword;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Update Profile
const updateUser = async (req, res, next) => {
  try {
    const { fullName } = req.body;
    const { id } = req.user;

    const user = await userModel.findById(id);

    if (!user) {
      return next(new AppError("User does not exist", 400));
    }

    if (fullName) {
      user.fullName = fullName;
    }

    if (req.file) {
      if (user.avatar.public_id) {
        await deleteFromSpaces(user.avatar.public_id); // Delete old avatar
      }

      const fileName = `Learning-Management-System/avatars/${Date.now()}-${req.file.filename}`;
      const uploadResult = await uploadToSpaces(req.file.path, fileName);

      user.avatar.public_id = fileName;
      user.avatar.secure_url = uploadResult.Location;

      fs.rmSync(req.file.path); // Remove file from server
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user,
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

export {
  register,
  login,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  updateUser,
};
