import Item from "../models/Item";
import asyncHandler from "express-async-handler";
import Sale from "../models/Sale";

export const getItem = asyncHandler(async(req, res) => {
    const item = await Item.findById(req.params.id);

    if(item){
        res.status(item);
    }else {
        res.status(404);
        throw new Error ('Bad request');
    }
});


// create Item worked with three error handling functions, need to check whether they all work 
const errorHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch((error) => next(next))
    }
}


export const createItem = errorHandler( async(req, res) => {
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




export const createItem2 = async( req, res) => {

    try{
        const { name, description, price, category, quantity } = req.body;

        const itemExists = await Item.findOne( { name });
        if(itemExists) {
            return res.status(400).json({
                success: false,
                error: 'Item exists'
            });
        }
        const createNewItem = await Item.create({
            name,
            description,
            price,
            category,
            quantity: quantity || 0
        });
        const populatedItem = await Item.findbyId(itemExists._id).populate('category', ' description');
         res.status(201). json(populatedItem);    
    }  
    catch( error ){
        let statusCode = 500    // default to internal server error
        let errorMessage = 'server erro';

        if( error.name === 'validationError'){
            statusCode = 400;
            errorMessage = error.message;
        }else if( error.name === 'CastError'){
            statusCode = 404;
            errorMessage = ' Invalid data format'
        }
        res.status(statusCode).json({
            success: false,
            error: errorMessage,

        });
    }
}

export const createItem3 = asyncHandler( async(req, res) => {
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
     const populatedItems = await Item.findById(Item._id).populate('nsme', 'description');
     res.status(200).json(populatedItems);
});



export const updateItem = asyncHandler( async( req, res) => {

    const selectedItem = await Item.findById(req.params.id);

    if(selectedItem){

        selectedItem.name = req.body.name || selectedItem.name;
        selectedItem.description = req.body.description || selectedItem.description;
        selectedItem.category = req.body.category || selectedItem.category;
        selectedItem.quantity = req.body.quatity || selectedItem.quantity;
        selectedItem.price = req.body.price || selectedItem.price
    

    const updatedItem = await selectedItem.save();

    const populatedItem = await Item.findById(updatedItem._id).populate('category', 'description');

    res.json(populatedItem);

    } else{
        res.status(404);
        throw new Error('Item not found');
    }
});

export const deleteItem = asyncHandler( async(req, res) => {
     
    //find item by from the request parameter
    const item = await Item.findById(req.params.id);
    //check if the item is in the database
    if(item) {
        //if exist,  check if there are any sale record
        //ab wushti Ssle collection where item fiesld matches items Id
        const salesWithItem = await Sale.find( { item: item._id});
            if( salesWithItem.length>0){
                //deletes all sales records associated eith the item
                await Sale.deleteMany({ item: item._id});
            }
            //delete the Item itself from the db
        await Item.deleteOne( { _id: item._id});
        //send success report to client
        res.json({ message: 'Item and Sale deleted'})
    }else {
        res.status(404);
        throw new Error( ' item not found');
    }

})
export const getItemsByCategory = asyncHandler( async( req, res) => {
    //ab route nserhela ena 
    ///categories/:id/items
    const itemsWithCategory = await Item.find({ category: req.params.categoryId})
    //populate the category with specific data from the category collection
    .populate('category', 'name description');

    res.status(itemsWithCategory)
})

export const getItems = asyncHandler( async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const itemLimit = parseInt(req.query.search) || 10;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc'? 1 : -1;
    const skip = (page - 1) * itemLimit;

    const filter = {};
    if(search){
        filter.$or = [
            {name : { $regex: search, $option: 'i'}},
            {description: { $regex: search, $optionoptions: 'i'}}
        ];
    }
    if(category){
        filter.category = category;
    }
})