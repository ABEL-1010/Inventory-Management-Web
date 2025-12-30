import express from 'express';
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/userController';
import  { protect, admin } from '../middleware/authMiddleware'

const userRoutes = express.Router();

userRoutes.route('/')
   .get(protect, admin, getUsers)
   .post(protect, admin, createUser );

userRoutes.route('/:id')
   .get(protect, admin, getUser)
   .put(protect, admin, updateUser)
   .delete(protect, admin, deleteUser);

export default userRoutes;


// userRoutes.get('/users', protect, admin, getUsers )
//userRoutes.post('/user', protect, admin, createUser )
// userRoutes.get('/user/123', protect, admin, getUser )
// userRoutes.put('/user/1234', protect, admin, updateUser )
// userRoutes.delete('/user/123', protect, admin, deleteUser )