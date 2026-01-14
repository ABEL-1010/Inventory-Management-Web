import asyncHandler from 'express-async-handler';
import Sale from '../models/Sale.js';
import Item from '../models/Item.js';
import Category from '../models/Category.js';

// @desc    Get sales by item
// @route   GET /api/reports/sales-by-item
// @access  Private
// Export controller function to get sales aggregated by individual items
export const getSalesByItem = asyncHandler(async (req, res) => {
  // Destructure query parameters from request URL
  const { startDate, endDate, category } = req.query;
  
  // STEP 1: BUILD DATE FILTER
  // Initialize empty date filter object
  const dateFilter = {};
  // Check if either startDate or endDate is provided
  if (startDate || endDate) {
    // Create saleDate filter object
    dateFilter.saleDate = {};
    // Add start date filter if provided (greater than or equal to)
    if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
    // Add end date filter if provided (less than or equal to)
    if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
  }

  // STEP 2: BUILD CATEGORY FILTER
  // Initialize empty category filter
  let categoryFilter = {};
  // Check if category filter is provided
  if (category) {
    // Find all items belonging to the specified category
    const categoryItems = await Item.find({ category }).select('_id');
    // Extract just the item IDs from the results
    const itemIds = categoryItems.map(item => item._id);
    // Create filter to match sales where item ID is in the list
    categoryFilter = { item: { $in: itemIds } };
  }

  // STEP 3: PERFORM AGGREGATION PIPELINE
  // MongoDB aggregation to group sales by item and calculate statistics
  const salesByItem = await Sale.aggregate([
    // STAGE 1: Match/Filters
    // Filter sales based on date and category criteria
    {
      $match: {
        ...dateFilter,        // Apply date range filter (if any)
        ...categoryFilter     // Apply category filter (if any)
      }
    },
    // STAGE 2: First Lookup - Join with items collection
    // Get item details for each sale
    {
      $lookup: {
        from: 'items',              // Collection to join from
        localField: 'item',         // Field from Sale collection (item ID)
        foreignField: '_id',        // Field from Item collection (_id)
        as: 'itemDetails'           // Output array field name
      }
    },
    // STAGE 3: Unwind itemDetails array
    // Convert the array of item details into individual documents
    {
      $unwind: '$itemDetails'       // Flatten itemDetails array
    },
    // STAGE 4: Second Lookup - Join with categories collection
    // Get category details for each item
    {
      $lookup: {
        from: 'categories',         // Collection to join from
        localField: 'itemDetails.category',  // Field from itemDetails (category ID)
        foreignField: '_id',        // Field from Category collection (_id)
        as: 'categoryDetails'       // Output array field name
      }
    },
    // STAGE 5: Unwind categoryDetails array (optional)
    // Convert array to object, preserving documents even if no category found
    {
      $unwind: {
        path: '$categoryDetails',   // Flatten categoryDetails array
        preserveNullAndEmptyArrays: true  // Keep documents even if no category
      }
    },
    // STAGE 6: Group by item
    // Aggregate all sales data for each unique item
    {
      $group: {
        _id: '$item',               // Group by item ID
        itemName: { $first: '$itemDetails.name' },  // Get item name from first occurrence
        categoryName: { $first: '$categoryDetails.name' },  // Get category name
        totalQuantity: { $sum: '$quantity' },        // Sum all quantities sold
        totalRevenue: { $sum: '$totalAmount' },      // Sum all revenue generated
        averagePrice: { $avg: '$itemDetails.price' }, // Calculate average item price
        saleCount: { $sum: 1 }      // Count number of sales transactions
      }
    },
    // STAGE 7: Project/Transform output
    // Format the output structure and calculations
    {
      $project: {
        _id: 0,                     // Exclude the MongoDB _id field
        itemId: '$_id',             // Rename _id to itemId
        itemName: 1,                // Include itemName field
        categoryName: 1,            // Include categoryName field
        totalQuantity: 1,           // Include totalQuantity field
        totalRevenue: 1,            // Include totalRevenue field
        averagePrice: { $round: ['$averagePrice', 2] },  // Round average price to 2 decimals
        saleCount: 1                // Include saleCount field
      }
    },
    // STAGE 8: Sort results
    // Order results by total revenue (highest first)
    {
      $sort: { totalRevenue: -1 }   // Sort descending by totalRevenue
    }
  ]);

  // STEP 4: CALCULATE SUMMARY STATISTICS
  // Compute overall totals from the aggregated item data
  const summary = {
    totalItems: salesByItem.length,  // Count of unique items sold
    totalQuantity: salesByItem.reduce((sum, item) => sum + item.totalQuantity, 0),  // Sum all quantities
    totalRevenue: salesByItem.reduce((sum, item) => sum + item.totalRevenue, 0),    // Sum all revenue
    averageRevenuePerItem: salesByItem.length > 0 
      ? salesByItem.reduce((sum, item) => sum + item.totalRevenue, 0) / salesByItem.length 
      : 0  // Calculate average revenue per item (avoid division by zero)
  };

  // STEP 5: SEND RESPONSE
  // Return JSON response with all computed data
  res.json({
    salesByItem,    // Array of sales data grouped by item
    summary,        // Summary statistics object
    filters: {      // Echo back the filters applied for reference
      startDate: startDate || 'All time',          // Start date used or default text
      endDate: endDate || 'All time',              // End date used or default text
      category: category || 'All categories'       // Category used or default text
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