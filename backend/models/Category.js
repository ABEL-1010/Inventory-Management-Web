//importing mongoose library, provides an interface
import mongoose from 'mongoose';

//structure of document define ygebr
//mongoose.Schema  constructer that creates new schema object
const categorySchema = mongoose.Schema({
    name: {    
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

//mongoose.model   creates a model from schema
export default mongoose.model('Category', categorySchema);

//collection  Categories,