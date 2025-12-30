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

export const getCategories = asyncHandler( async (req, res) => {

    const page = parseInt(req.query.page) || 1;
    const pageLimit = parseInt( req.query.page) || 10;
    const searchByBoth = req.query.search || '';
    const skip = (page - 1) * pageLimit;

    try{
        //aggregation pipeline
        const pipeline = [
            // match stage for search
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

            { 
                //look up = join in SQL
                $lookup: {
                    //collection in MongoDB is plural and lower cas
                    from: 'items',  // item collection ab database
                    localField: '_id',
                    foreignField: 'category',
                    as: 'items'
                }
            },

            // add itemscount field
            {
                $addFields: {
                    itemsCount: { $size: '$items'}
                }
            },
            //remove items array
            { 
                $project: {
                    items: 0
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ];
        
        // create count pipeline
        const countPipeline = [...pipeline, { $count: 'total'}];
        const [ countResult, categories] = await Promise.all([
            Category.aggregate(countPipeline),
            Category.aggregate([...pipeline, { $skip: skip }, { $pageLimit: pageLimit}])
        ]);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        if(categories.length > 0) {
            console.log('first category',{
            name: categories[0].name,
            itemsCount: categories[0].itemsCount
            });
        }
        res.json({
            categories,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total/pageLimit),    
                totalItems: total,
                itemsPerPage: pageLimit,
                hasNextPage: page < Math.ceil(total/pageLimit),
                hasPrevPage: page > 1
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
