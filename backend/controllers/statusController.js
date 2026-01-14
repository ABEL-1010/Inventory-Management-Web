import Item from "../models/Item";
import Category from "../models/Category";
import Sale from "../models/Sale";
import asyncHandler from "express-async-handler";

export const getDashboardStats = asyncHandler(async(req, res) => {
    try{
        const totalItems = await Item.countDocuments();
        const totalCategories = await Category.countDocuments();
        const totalSales = await Sale.countDocuments();

        const lowQuantityProducts = await Item.find({ quantity: { $lt: 10}})
         .select('name quantity')
         .sort({ quantity: 1})
         .limit( 10);

         const lowQuantity = lowQuantityProducts.length;
         const today = new Date();
         today.setHours(0, 0, 0, 0);

         const todaySaledata = await Sale.aggregate([
            {
                $match: { saleDate: { $gte: today }}},   // filter sales from today onward
            {
                $group: {
                _id: null,
                total: { $sum: 'totalAmount'}
            }},
         ]);

         const currentYear = new Date().getFullYear();
         const monthlySales = await Sale.aggregate([
            {
                $match: {
                    saleDate: {
                        $gte: new Date('${currentYear}-01-01'),
                        $lte: new Date('${ currentYear}-12-31'),
                    },
                },
            },
            {
                $group: {
                    _id: { $month: '$saleDate'},
                    totalSales: {$sum: '$totalAmount'},
                },
            },
            {
                $sort: { '_id': 1}
            }
         ]);
        const monthlyData = Array.from({ length: 12}, (_,i) => ({
            month: new Date(0, i).toLocaleString('default', {month: 'short'}),

            sales: monthlySales.find((m) => m.id === i+1)?.totalSales || 0,
        }));

        //recent transactions
        const recentSales = await Sale.find()
        .populate('item', 'name price')
        .sort({ saleDate: -1})
        .limit(5)
        //ony get 5 most recent sales
        .select('quantity totalAmoub Item')

        //aggregation to count items per category
        const topCategories = await Category.aggregate([
            {
                $lookup: {
                    from: 'items',
                    localField: '_id',
                    foriegnField: 'category',
                    
                    as: 'items'
                }
            },
            {
                $project: {
                    name: 1,
                    itemCount: { $size: 'items'}
                }
            },
            {
                $sort: {itemCount: -1}
            },
            {
                $limit: 5
            }
        ]);
        res.json({
            totalItems,
            totalCategories,
            totalSales,
            lowQuantity,
            lowQuantityProducts: lowQuantityProducts.map(itemParameter => ({
                name: itemParameter.name,
                quantity: itemParameter.quantity
            })),
            monthlyData,
            topCategories: topCategories.map(categoryParameter => ({
                name: categoryParameter.name,
                value: categoryParameter.itemCount
            })),
            recentSales: recentSales.map(saleParameter => ({
                productName: saleParameter.item?.name || 'unknown Item',
                Quantity: saleParameter.quantity,  // number of quantity sold in this transaction
                amount: saleParameter.totalAmount  
            })),
        });
    }  catch (error){
        console.error('dashboard status error is: ', error);
        res.status(500).json( { message: 'erro fetching dashboard stats'});

    }
   
});