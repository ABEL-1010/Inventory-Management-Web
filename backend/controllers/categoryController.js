import asyncHandler from 'express-async-handler';
import Category from '../models/Category';
import Item from '../models/Item';
import Sale from '../models/Sale';
import { Promise } from 'mongoose';


export const getCategory = asyncHandler(async (req, res) => {

    //single category retrieve ngebrlena
    const categoryId = await Category.findById(req.params.id);
    //check if category exist
    if(categoryId) {
        //If found send the category data as json file
        res.json(categoryId);
    } else{ 
        res.status(404);
        throw new Error('category not found');
    }
});

export const createCategory = asyncHandler(async (req, res) => {
    // destructure name and description from req body
    const { name, description } = req.body;
    //check if category with the same name exists
    const categoryExists = await Category.findOne({ name });

    if(categoryExists) {
        res.status(400);
        throw new Error('category already Exists');
    }
    //create new category in the database 
    const category = await Category.create({ name, description});

    res.status(201).json( category);
});

export const updateCategory = asyncHandler(async (req, res) => {
    // find category by id from url parameters
    const category = await Category.findById(req.params.id);
    //check 
    if( category){

        //update category name and description with new value or keep existing
        category.name = req.body.name || category.name;
        category.description = req.body.description || category.description;

        // save the updated category to database
        const updatedCategory = await category.save();
        
        //return the updated category as json file
        res.json (updatedCategory);

    }else {
        res.status(404);
        throw new Error('category not found');
    }
});

export const deleteCategory = asyncHandler(async(req, res) => {
    //find category By Id from URL
    //const category = await Category.findById('abcd12');
    const category = await Category.findById(req.params.id);

    //check if category does not exist   
    //
    if(!category){
        res.status(404);
        throw new Error('category not found');
    }
    //find all items that are in the same category
    //category._id   this is MongoDB object Id
    const itemsWithCategory = await Item.find({ category: category._id});

    //check if there are any items in the category
    if(itemsWithCategory.length > 0){

        // loop through each item in the category
        for(const item of itemsWithCategory){
                
            //delete all sales records linked mszi specific Item
            //deleteMany   this is moongose method
            await Sale.deleteMany( { item: item_id});
        }
        //delete all items that have this category._id
        await Item.deleteMany({ category: category._id })
    }
        //delete the category itself
    await category.deleteOne({ _id: category._id});
    
    res.json({ message: 'Category, Items and sales deleted'})
})


// After frontend   ????????


export const getCategories = asyncHandler( async (req, res) => {

    const page = parseInt(req.query.page) || 1;
    //extract limit
    //Item limit 
    const itemLimit = parseInt( req.query.page) || 10;
    //calculate how many page to skip for pagination
    const skip = (page - 1) * itemLimit;
    const searchByBoth = req.query.search || '';

    try{
        //aggregation pipeline
        const pipeline = [
            // match stage for search
            // JavaScript spread operator with(...) ternary operator

            //...(condition ? [arrayIfTrue] : [arrayIfFalse])
             
            ...(search ? [{   
                //if search variable is true
                $match: {
                    // match = where
                    $or: [
                        //regular expression
                        { name: { $regex: searchByBoth, $options: 'i'}},
                        { description: { $regex: searchByBoth, $options: 'i'}}
                    ]
                }
            }] : []),
            // If no search empty array, no stage added

            { 
                //look up = join in SQL   looks up items belonging to each category
                $lookup: {
                    //collection in MongoDB is plural and lower case
                    from: 'items',  // item collection ab database
                    localField: '_id',
                    foreignField: 'category',  //from items collection that reference to category
                    as: 'items'   //output array field name containing matched items
                }
            },

            // add itemscount field
            //counts items per category using $size
            {
                $addFields: {
                    itemsCount: { $size: '$items'}  // size operator to count items
                }
            },
            //remove items array
            // project stage, remove the items array to reduce response size
            //we only need count
            { 
                $project: {
                    items: 0  // exclude this field from output
                    // 
                }
            },

            //sort 
            {
                $sort: {
                    createdAt: -1  // descending order
                }
            }
        ];
        
        // separate pipeline for counting total documents
        //added count stage to get total number except pagination
        const countPipeline = [...pipeline, { $count: 'total'}];

        //execute both queries in parallel for better performance
        //runs count and data queries simultaneously
        const [ countResult, categories] = await Promise.all([
            Category.aggregate(countPipeline),   //get total count

            //get paginated data
            Category.aggregate([...pipeline, { $skip: skip }, { $itemLimit: itemLimit}])  
        ]);
        //extract total count from countResult, default 0
        const total = countResult.length > 0 ? countResult[0].total : 0;

        if(categories.length > 0) {
            console.log('first category',{
            name: categories[0].name,
            itemsCount: categories[0].itemsCount
            });
        }
        //send JSON response with data and pagination data
        res.json({
            categories,  // the actuall category data
            pagination: {          //pagination data for frontend
                currentPage: page,
                totalPages: Math.ceil(total/itemLimit),   //total number of pages 
                totalItems: total,   // total number of items across all pages
                itemsPerPage: itemLimit,   //numbers of items oer oage
                hasNextPage: page < Math.ceil(total/itemLimit),   //boolean if next page exists
                hasPrevPage: page > 1    //boolean if prev page exists
            }
        });
    } catch (error) {
        console.error('error in categories is : ', error);
        res.status(500).json({
            message: 'error of fetching categories',
            error: error.message
        });
    }
});
