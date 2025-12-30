import Item from "../models/Item";
import expressAsyncHandler from "express-async-handler";

export const getItem = expressAsyncHandler(async(req, res) => {
    const item = await Item.findById(req.params.id);

    if(item){
        res.status(item);
    }else {
        res.status(404);
        throw new Error ('Bad request');
    }
});

export const createItem = expressAsyncHandler( async(req, res) => {

    const { name, description, price, category, quantity } = req.body;

    const itemExists = await Item.findOne( name );
     if(itemExists){
        res.json(404);
     }else{ 
        const newItem = await Item.create({
            name,
            description,
            price,
            category,
            quantity: quantity || 0
        });  
     }
     const populatedItems = await Item.findById(item._id).populate('nsme', 'description');
     res.status(200).json(populatedItems);
});