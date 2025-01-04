import { S3Client, PutObjectCommand, DeleteObjectCommand, Upload } from '@aws-sdk/client-s3';
import courseModel from '../models/course.model.js';
import AppError from '../utils/error.utils.js';
import fs from 'fs';
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

// Utility function to upload video in chunks (multipart upload)
const uploadVideoInChunks = async (filePath, fileName) => {
  const fileStream = fs.createReadStream(filePath);
  const uploadParams = {
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: fileName,
    Body: fileStream,
    ACL: 'public-read', // Make it publicly readable
  };

  const uploader = new Upload({
    client: s3Client,
    params: uploadParams,
    partSize: 5 * 1024 * 1024, // 5 MB per part, adjust as necessary
    leavePartsOnError: false, // Ensure parts are removed if the upload fails
  });

  try {
    const result = await uploader.done(); // Start the upload process
    return {
      Location: result.Location,
      Key: result.Key,
    };
  } catch (error) {
    throw new Error(`Error uploading video: ${error.message}`);
  }
};

// Utility function to delete a video file from DigitalOcean Spaces
const deleteFromSpaces = async (fileName) => {
  const params = {
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: fileName,
  };

  const command = new DeleteObjectCommand(params);
  await s3Client.send(command);
};

// Get all courses
const getAllCourses = async (req, res, next) => {
  try {
    const { email, role, category } = req.user;
    let courses;
    if (role === "USER") {
      if (category) {
        courses = await courseModel.find({ category }).select('-lectures');
      } else {
        courses = await courseModel.find().select('-lectures');
      }
    } else {
      courses = await courseModel.find().select('-lectures');
    }

    res.status(200).json({
      success: true,
      message: 'All courses',
      courses,
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Get specific course by ID
const getLecturesByCourseId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await courseModel.findById(id);

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Course found',
      course,
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Create a new course
const createCourse = async (req, res, next) => {
  try {
    const { title, description, category, createdBy } = req.body;

    if (!title || !description || !category || !createdBy) {
      return next(new AppError('All fields are required', 400));
    }

    const course = await courseModel.create({
      title,
      description,
      category,
      createdBy,
    });

    if (req.file) {
      const fileName = `Learning-Management-System/${req.file.filename}`;
      const uploadResult = await uploadVideoInChunks(req.file.path, fileName); // Use chunked upload

      course.thumbnail.public_id = fileName;
      course.thumbnail.secure_url = uploadResult.Location;

      fs.rmSync(req.file.path); // Clean up the file after upload
    }

    await course.save();

    res.status(200).json({
      success: true,
      message: 'Course successfully created',
      course,
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

// Remove a course
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

// Delete a lecture from a course
const deleteCourseLecture = async (req, res, next) => {
  try {
    const { courseId, lectureId } = req.query;
    const course = await courseModel.findById(courseId);

    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    const lectureIndex = course.lectures.findIndex(
      (lecture) => lecture._id.toString() === lectureId
    );

    if (lectureIndex === -1) {
      return next(new AppError('Lecture not found', 404));
    }

    const lecture = course.lectures[lectureIndex];
    if (lecture.lecture.public_id) {
      await deleteFromSpaces(lecture.lecture.public_id);
    }

    course.lectures.splice(lectureIndex, 1);
    course.numberOfLectures = course.lectures.length;

    await course.save();

    res.status(200).json({
      success: true,
      message: 'Lecture deleted successfully',
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

// Update a lecture in a course
const updateCourseLecture = async (req, res, next) => {
  try {
    const { courseId, lectureId } = req.query;
    const { title, description } = req.body;

    if (!title || !description) {
      return next(new AppError('All fields are required', 400));
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      return next(new AppError('Course not found', 404));
    }

    const lectureIndex = course.lectures.findIndex(
      (lecture) => lecture._id.toString() === lectureId
    );

    if (lectureIndex === -1) {
      return next(new AppError('Lecture not found', 404));
    }

    const lecture = course.lectures[lectureIndex];
    lecture.title = title;
    lecture.description = description;

    if (req.file) {
      if (lecture.lecture.public_id) {
        await deleteFromSpaces(lecture.lecture.public_id);
      }

      const fileName = `Learning-Management-System/${Date.now()}-${req.file.filename}`;
      const uploadResult = await uploadVideoInChunks(req.file.path, fileName); // Use chunked upload

      lecture.lecture.public_id = fileName;
      lecture.lecture.secure_url = uploadResult.Location;
    }

    await course.save();

    res.status(200).json({
      success: true,
      message: 'Lecture updated successfully',
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

export {
  createCourse,
  getAllCourses,
  getLecturesByCourseId,
  updateCourse,
  removeCourse,
  addLectureToCourseById,
  deleteCourseLecture,
  updateCourseLecture,
};
