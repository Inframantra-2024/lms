import categoryModel from "../models/category.model.js";
import AppError from "../utils/error.utils.js";

// Create a new category
export const createCategory = async (req, res, next) => {
    try {
        const { category } = req.body;

        // Validate input
        if (!category) {
            return next(new AppError("Category name is required", 400));
        }

        // Check for duplicates
        const existingCategory = await categoryModel.findOne({ category });
        if (existingCategory) {
            return next(new AppError("Category already exists", 400));
        }

        // Save the category
        const newCategory = await categoryModel.create({ category });
        res.status(201).json({
            success: true,
            message: "Category created successfully",
            category: newCategory,
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

// Get all categories
export const getAllCategories = async (req, res, next) => {
    try {
        const categories = await categoryModel.find();
        res.status(200).json({
            success: true,
            categories,
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

// Get a single category by ID
export const getCategoryById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const category = await categoryModel.findById(id);

        if (!category) {
            return next(new AppError("Category not found", 404));
        }

        res.status(200).json({
            success: true,
            category,
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

// Update a category by ID
export const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { category } = req.body;

        // Validate input
        if (!category) {
            return next(new AppError("Category name is required", 400));
        }

        // Update category
        const updatedCategory = await categoryModel.findByIdAndUpdate(
            id,
            { category },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return next(new AppError("Category not found", 404));
        }

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            category: updatedCategory,
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

// Delete a category by ID
export const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        const deletedCategory = await categoryModel.findByIdAndDelete(id);

        if (!deletedCategory) {
            return next(new AppError("Category not found", 404));
        }

        res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};
