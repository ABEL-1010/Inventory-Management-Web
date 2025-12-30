import mongoose from "mongoose";

const saleSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1, //you can't sell 0 or 1 
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    saleDate: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        dafault: Date.now
    }
});

export default mongoose.model('Sale', saleSchema);