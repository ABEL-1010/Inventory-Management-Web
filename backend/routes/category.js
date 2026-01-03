import express from 'express';
import { getCategory, createCategory, updateCategory, deleteCategory, getCategories} from '../controllers/categoryController';
import { protect, admin } from '../middleware/authMiddleware';

const categoryRoutes = express.Router();

categoryRoutes.route ('/')
    .get(getCategories);
    
categoryRoutes.route ('/:id')
    .get(getCategory)     
    .post(protect, admin, createCategory)
    .put(protect, admin, updateCategory)
    .delete(protect, admin, deleteCategory)

// export the router to be used in server.js    
export default categoryRoutes;  

//Categories/123456