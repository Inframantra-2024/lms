import { Schema, model } from "mongoose";

const category = new Schema({
    category: {
        type: String,
        required: [true, 'Name is required'],
        minLength: [3, 'Name must be at least 5 character'],
        maxLength: [20, 'Name should be less than 20 character'],
        lowercase: true,
        unique:true
    },
    
},
    {
        timestamps: true
    });







export default model("Category", category);