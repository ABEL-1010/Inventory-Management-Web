import asyncHandler from 'express-async-handler';
import Sale from '../models/Sale.js';
import Item from '../models/Item.js';
import Category from '../models/Category.js';

// @desc    Get sales by item
// @route   GET /api/reports/sales-by-item
// @access  Private
export const getSalesByItem = asyncHandler(async (req, res) => {
  const { startDate, endDate, category } = req.query;
  
  // Build date filter
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.saleDate = {};
    if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
    if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
  }

  // Build category filter
  let categoryFilter = {};
  if (category) {
    // Find items in this category first
    const categoryItems = await Item.find({ category }).select('_id');
    const itemIds = categoryItems.map(item => item._id);
    categoryFilter = { item: { $in: itemIds } };
  }

  const salesByItem = await Sale.aggregate([
    {
      $match: {
        ...dateFilter,
        ...categoryFilter
      }
    },
    {
      $lookup: {
        from: 'items',
        localField: 'item',
        foreignField: '_id',
        as: 'itemDetails'
      }
    },
    {
      $unwind: '$itemDetails'
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'itemDetails.category',
        foreignField: '_id',
        as: 'categoryDetails'
      }
    },
    {
      $unwind: {
        path: '$categoryDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: '$item',
        itemName: { $first: '$itemDetails.name' },
        categoryName: { $first: '$categoryDetails.name' },
        totalQuantity: { $sum: '$quantity' },
        totalRevenue: { $sum: '$totalAmount' },
        averagePrice: { $avg: '$itemDetails.price' },
        saleCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        itemId: '$_id',
        itemName: 1,
        categoryName: 1,
        totalQuantity: 1,
        totalRevenue: 1,
        averagePrice: { $round: ['$averagePrice', 2] },
        saleCount: 1
      }
    },
    {
      $sort: { totalRevenue: -1 }
    }
  ]);

  // Calculate summary
  const summary = {
    totalItems: salesByItem.length,
    totalQuantity: salesByItem.reduce((sum, item) => sum + item.totalQuantity, 0),
    totalRevenue: salesByItem.reduce((sum, item) => sum + item.totalRevenue, 0),
    averageRevenuePerItem: salesByItem.length > 0 
      ? salesByItem.reduce((sum, item) => sum + item.totalRevenue, 0) / salesByItem.length 
      : 0
  };

  res.json({
    salesByItem,
    summary,
    filters: {
      startDate: startDate || 'All time',
      endDate: endDate || 'All time',
      category: category || 'All categories'
    }
  });
});

// @desc    Get sales by date
// @route   GET /api/reports/sales-by-date
// @access  Private
export const getSalesByDate = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;
  
  // Build date filter
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.saleDate = {};
    if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
    if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
  }

  let dateFormat, dateProjection;
  
  switch (groupBy) {
    case 'month':
      dateFormat = { year: { $year: '$saleDate' }, month: { $month: '$saleDate' } };
      dateProjection = {
        periodLabel: { 
          $dateToString: { 
            format: '%Y-%m', 
            date: '$saleDate' 
          } 
        }
      };
      break;
    case 'week':
      dateFormat = { year: { $year: '$saleDate' }, week: { $week: '$saleDate' } };
      dateProjection = {
        periodLabel: {
          $concat: [
            'Week ',
            { $toString: { $week: '$saleDate' } },
            ', ',
            { $toString: { $year: '$saleDate' } }
          ]
        }
      };
      break;
    case 'day':
    default:
      dateFormat = { 
        $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } 
      };
      dateProjection = {
        periodLabel: { 
          $dateToString: { 
            format: '%Y-%m-%d', 
            date: '$saleDate' 
          } 
        }
      };
      break;
  }

  const salesByDate = await Sale.aggregate([
    {
      $match: dateFilter
    },
    {
      $group: {
        _id: dateFormat,
        totalSales: { $sum: '$quantity' },
        totalRevenue: { $sum: '$totalAmount' },
        transactionCount: { $sum: 1 },
        averageSaleValue: { $avg: '$totalAmount' },
        firstSaleDate: { $min: '$saleDate' }
      }
    },
    {
      $project: {
        _id: 0,
        period: '$_id',
        periodLabel: 1,
        totalSales: 1,
        totalRevenue: 1,
        transactionCount: 1,
        averageSaleValue: { $round: ['$averageSaleValue', 2] },
        date: '$firstSaleDate'
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);

  // Format the period labels properly
  const formattedSales = salesByDate.map(sale => {
    let periodLabel = sale.periodLabel;
    
    if (groupBy === 'month' && sale.period) {
      const [year, month] = sale.period.split('-');
      periodLabel = new Date(year, month - 1).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
    } else if (groupBy === 'day' && sale.date) {
      periodLabel = new Date(sale.date).toLocaleDateString('en-US');
    }

    return {
      ...sale,
      periodLabel
    };
  });

  // Calculate summary
  const summary = {
    totalPeriods: formattedSales.length,
    totalSales: formattedSales.reduce((sum, period) => sum + period.totalSales, 0),
    totalRevenue: formattedSales.reduce((sum, period) => sum + period.totalRevenue, 0),
    totalTransactions: formattedSales.reduce((sum, period) => sum + period.transactionCount, 0),
    averageDailyRevenue: formattedSales.length > 0 
      ? formattedSales.reduce((sum, period) => sum + period.totalRevenue, 0) / formattedSales.length 
      : 0
  };

  res.json({
    salesByDate: formattedSales,
    summary,
    filters: {
      startDate: startDate || 'All time',
      endDate: endDate || 'All time',
      groupBy
    }
  });
});

// @desc    Get sales by category
// @route   GET /api/reports/sales-by-category
// @access  Private
export const getSalesByCategory = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Build date filter
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.saleDate = {};
    if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
    if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
  }

  const salesByCategory = await Sale.aggregate([
    {
      $match: dateFilter
    },
    {
      $lookup: {
        from: 'items',
        localField: 'item',
        foreignField: '_id',
        as: 'itemDetails'
      }
    },
    {
      $unwind: '$itemDetails'
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'itemDetails.category',
        foreignField: '_id',
        as: 'categoryDetails'
      }
    },
    {
      $unwind: {
        path: '$categoryDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: '$categoryDetails._id',
        categoryName: { $first: '$categoryDetails.name' },
        categoryDescription: { $first: '$categoryDetails.description' },
        totalQuantity: { $sum: '$quantity' },
        totalRevenue: { $sum: '$totalAmount' },
        itemCount: { $addToSet: '$item' },
        saleCount: { $sum: 1 },
        averageSaleValue: { $avg: '$totalAmount' }
      }
    },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        categoryName: 1,
        categoryDescription: 1,
        totalQuantity: 1,
        totalRevenue: 1,
        itemCount: { $size: '$itemCount' },
        saleCount: 1,
        averageSaleValue: { $round: ['$averageSaleValue', 2] }
      }
    },
    {
      $sort: { totalRevenue: -1 }
    }
  ]);

  // Calculate total revenue for percentage calculation
  const totalRevenue = salesByCategory.reduce((sum, category) => sum + category.totalRevenue, 0);

  // Add revenue percentage
  const salesWithPercentage = salesByCategory.map(category => ({
    ...category,
    revenuePercentage: totalRevenue > 0 ? (category.totalRevenue / totalRevenue * 100) : 0
  }));

  // Calculate summary
  const summary = {
    totalCategories: salesWithPercentage.length,
    totalItems: salesWithPercentage.reduce((sum, category) => sum + category.itemCount, 0),
    totalQuantity: salesWithPercentage.reduce((sum, category) => sum + category.totalQuantity, 0),
    totalRevenue: totalRevenue,
    totalSales: salesWithPercentage.reduce((sum, category) => sum + category.saleCount, 0),
    averageRevenuePerCategory: salesWithPercentage.length > 0 
      ? totalRevenue / salesWithPercentage.length 
      : 0
  };

  res.json({
    salesByCategory: salesWithPercentage,
    summary,
    filters: {
      startDate: startDate || 'All time',
      endDate: endDate || 'All time'
    }
  });
});
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get total items count
  const totalItems = await Item.countDocuments();
  
  // Get total categories count
  const totalCategories = await Category.countDocuments();
  
  // Get total sales and revenue
  const salesStats = await Sale.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalItemsSold: { $sum: '$quantity' },
        totalTransactions: { $sum: 1 }
      }
    }
  ]);

  // Get low stock items (quantity < 10)
  const lowStockItems = await Item.countDocuments({ quantity: { $lt: 10 } });
  
  // Get today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaySales = await Sale.aggregate([
    {
      $match: {
        saleDate: {
          $gte: today,
          $lt: tomorrow
        }
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        itemsSold: { $sum: '$quantity' }
      }
    }
  ]);

  const stats = {
    totalItems,
    totalCategories,
    totalRevenue: salesStats[0]?.totalRevenue || 0,
    totalItemsSold: salesStats[0]?.totalItemsSold || 0,
    totalTransactions: salesStats[0]?.totalTransactions || 0,
    lowStockItems,
    todayRevenue: todaySales[0]?.revenue || 0,
    todayItemsSold: todaySales[0]?.itemsSold || 0
  };

  res.json(stats);
});