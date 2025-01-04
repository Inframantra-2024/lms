import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Initialize the S3 client for DigitalOcean Spaces
const s3Client = new S3Client({
  endpoint: "https://blr1.digitaloceanspaces.com", // DigitalOcean Spaces endpoint
  region: "blr1", // Your Spaces region
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY, // Access key
    secretAccessKey: process.env.DO_SPACES_SECRET, // Secret key
  },
});

// Utility function to upload video in chunks (multipart upload)
const uploadVideoInChunks = async (filePath, fileName) => {
  const fileStream = fs.createReadStream(filePath);
  const fileSize = fs.statSync(filePath).size;

  const uploadParams = {
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: fileName,
    Body: fileStream,
    ACL: 'public-read', // Make it publicly readable
  };

  try {
    // Step 1: Initiate the multipart upload
    const createMultipartUploadCommand = new CreateMultipartUploadCommand(uploadParams);
    const multipartUpload = await s3Client.send(createMultipartUploadCommand);
    const uploadId = multipartUpload.UploadId;
    
    const partSize = 5 * 1024 * 1024;  // Set part size to 5MB per chunk
    const parts = [];

    // Step 2: Upload the file in chunks
    for (let startByte = 0; startByte < fileSize; startByte += partSize) {
      const chunkSize = Math.min(partSize, fileSize - startByte);
      const filePartStream = fs.createReadStream(filePath, { start: startByte, end: startByte + chunkSize - 1 });

      const uploadPartParams = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: fileName,
        PartNumber: Math.floor(startByte / partSize) + 1,
        UploadId: uploadId,
        Body: filePartStream,
      };

      const uploadPartCommand = new UploadPartCommand(uploadPartParams);
      const uploadedPart = await s3Client.send(uploadPartCommand);

      parts.push({
        ETag: uploadedPart.ETag,
        PartNumber: Math.floor(startByte / partSize) + 1,
      });
    }

    // Step 3: Complete the multipart upload
    const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: fileName,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    const result = await s3Client.send(completeMultipartUploadCommand);

    return result;
  } catch (error) {
    console.error('Error uploading file in chunks:', error);
    throw new Error('Error uploading video in chunks');
  }
};

import courseModel from '../models/course.model.js';
import AppError from '../utils/error.utils.js';
import fs from 'fs';
import { uploadVideoInChunks } from '../utils/uploadVideoInChunks.js'; // Import the upload function

// Add a lecture to a course by ID
const addLectureToCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
      return next(new AppError('All fields are required', 400));
    }

    const course = await courseModel.findById(id);
    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    const lectureData = { title, description, lecture: {} };

    if (req.file) {
      const fileName = `Learning-Management-System/${Date.now()}-${req.file.filename}`;
      const uploadResult = await uploadVideoInChunks(req.file.path, fileName); // Use chunked upload

      lectureData.lecture.public_id = fileName;
      lectureData.lecture.secure_url = uploadResult.Location;
    }

    course.lectures.push(lectureData);
    course.numberOfLectures = course.lectures.length;

    await course.save();

    res.status(200).json({
      success: true,
      message: 'Lecture added successfully',
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Update an existing course
const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await courseModel.findById(id);

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    if (req.file) {
      if (course.thumbnail.public_id) {
        await deleteFromSpaces(course.thumbnail.public_id);
      }

      const fileName = `Learning-Management-System/${Date.now()}-${req.file.filename}`;
      const uploadResult = await uploadVideoInChunks(req.file.path, fileName); // Use chunked upload

      course.thumbnail.public_id = fileName;
      course.thumbnail.secure_url = uploadResult.Location;

      fs.rmSync(req.file.path); // Clean up the file after upload
    }

    await course.updateOne({ $set: req.body }, { runValidators: true });

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Delete a course
const removeCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await courseModel.findById(id);

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    if (course.thumbnail.public_id) {
      await deleteFromSpaces(course.thumbnail.public_id);
    }

    await courseModel.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

export { addLectureToCourseById, updateCourse, removeCourse };

