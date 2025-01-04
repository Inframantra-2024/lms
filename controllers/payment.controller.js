import paymentModel from "../models/payment.model.js";
import userModel from "../models/user.model.js";
import AppError from "../utils/error.utils.js";

export const getRazorPayApiKey = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            message: "Dummy Razorpay API Key",
            key: "dummy_key", // Dummy API Key
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

export const buySubscription = async (req, res, next) => {
    try {
        const { id } = req.user;
        const user = await userModel.findById(id);

        if (!user) {
            return next(new AppError("Unauthorized, please login", 401));
        }

        if (user.role === "ADMIN") {
            return next(new AppError("Admin cannot purchase a subscription", 400));
        }

        // Dummy subscription creation
        const subscription = {
            id: `sub_dummy_${Date.now()}`,
            status: "active",
        };

        user.subscription.id = subscription.id;
        user.subscription.status = subscription.status;

        await user.save();

        res.status(200).json({
            success: true,
            message: "Dummy Subscribed Successfully",
            subscription_id: subscription.id,
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

export const verifySubscription = async (req, res, next) => {
    try {
        const { id } = req.user;
        const { razorpay_payment_id, razorpay_signature, razorpay_subscription_id } = req.body;

        const user = await userModel.findById(id);
        if (!user) {
            return next(new AppError("Unauthorized, please login", 401));
        }

        // Dummy verification
        if (razorpay_subscription_id !== user.subscription.id) {
            return next(new AppError("Payment Not Verified, please try again", 400));
        }

        await paymentModel.create({
            razorpay_payment_id: `dummy_payment_${Date.now()}`,
            razorpay_signature: `dummy_signature_${Date.now()}`,
            razorpay_subscription_id,
        });

        user.subscription.status = "active";
        await user.save();

        res.status(200).json({
            success: true,
            message: "Dummy Payment Verified Successfully",
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};

export const cancelSubscription = async (req, res, next) => {
    const { id } = req.user;

    const user = await userModel.findById(id);

    if (user.role === "ADMIN") {
        return next(new AppError("Admin does not need to cancel subscription", 400));
    }

    try {
        // Dummy cancellation
        user.subscription.status = "cancelled";
        await user.save();

        res.status(200).json({
            success: true,
            message: "Dummy Subscription Cancelled Successfully",
        });
    } catch (error) {
        return next(new AppError(error.message, 500));
    }
};

export const allPayments = async (req, res, next) => {
    try {
        const { count } = req.query;

        // Dummy payment list
        const subscriptions = Array.from({ length: count || 10 }, (_, i) => ({
            id: `dummy_subscription_${i}`,
            status: "active",
            created_at: new Date(),
        }));

        res.status(200).json({
            success: true,
            message: "Dummy Payments Retrieved",
            allPayments: subscriptions,
        });
    } catch (e) {
        return next(new AppError(e.message, 500));
    }
};
