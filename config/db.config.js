import mongoose from "mongoose";

mongoose.set('strictQuery', false);

const connectToDb = async () => {
    console.log(process.env.MONGO_URI)
    await mongoose.connect(process.env.MONGO_URI)
    .then((conn) => {console.log(`db connected: ${conn.connection.host}`);})
    .catch((err) => {console.log(`error in connected db: ${err.message}`);})
}

export default connectToDb;