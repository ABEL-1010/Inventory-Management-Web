import asyncHandler from 'express-async-handler';
import User from "../models/User";

//GET /api/users
export const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find().select('-password').sort({ createdAt: -1});  
    res.json(users);      //client get users
});

//export user function        sort users with newest first
//fetch all users             return users as Json to the clientt
//password exclude            handles error  bza asyncHandler

//getUsers--name of the function           asyncHandler----catch async error
//req object-request data          

//GET / user/:ById
export const getUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (user){
        res.json(user);
    } else {
        res.status(404);
        throw new Error ( 'User not found');
    }
});

export const createUser = asyncHandler ( async (req, res) => {
    const { name, email, password, role } = req.body;                  

    const userExists = await User.findOne ({ email});
    if (userExists) {                           // user exist lgebr tekoynu
        res.status(400);
        throw new Error('user already exists');
    }
    const user = await User.create({             // creates new user document       and stores new user
        name,
        email,
        password,                                      
        role: role || 'user'
    });
    if (user) {                              //conditional check if user was created
        res.status(201).json({             // excluding password ms 201 error          
            _id: user._id,                // returns mongodb documentId
            name: user.name,              //returns user name
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt
        });                               // closes json response
        
    } else {                            //if user creation failed   400(bad request)
        res.status(400);
        throw new Error('Invalid user data');
    }
});

export const updateUser = asyncHandler (async(req, res) => {                          
    const user = await User.findById(req.params.id);          //byid and req      Update/api/users/12345ab

    if(user) {       
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email; 
        user.role = req.body.role || user.role;
        user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;

    
        if (req.body.password) {
            user.password = req.body.password;
        }

        const updateUser = await user.save();
        res.json({                    
            _id: updateUser._id,
            name: updateUser.name,
            email: updateUser.email,
            role: updateUser.role,
            isActive: updateUser.isActive,                  //
            lastLogin: updateUser.lastlogin           //
        });

      }else {
        res.status(400);
        throw new Error('user not found');
    }
});

export const deleteUser = asyncHandler (async ( req, res) => {
    const user = await User.findById(req.params.id);             //DELETE /api/users/64f8a2

    if (user) {               //Prevent user from deleting their own account
        if (user._id.toString() === req.user._id.toString()){         //   req.user.   Comes from auth middleware
            res.status(400);
            throw new Error('cannot delete your acc');          
        }
        await User.deleteOne( { _id:user._id});
        res.json({ message: 'user removed'});
    } else {
        res.status(404);
        throw new Error('user not found');
    }
})