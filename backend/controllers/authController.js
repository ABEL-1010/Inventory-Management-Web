import asyncHandler from 'express-async-handler';
import User from '../models/User';
import generateToken from '../utils/generateToken';

export const loginUser = asyncHandler( async (req, res ) => {         
    const{ email, password} = req.body;

    const user = await User.findone( { email });

    if(user && (await user.matchPassword(password))){
        user.lastLogin = new Date();
        await user.save();

        res.json({
            _id:user._id,
            email:user.email,
            name: user.name,
            role: user.role,
            token: generateToken(user._id)
      

        });

    } else {
        res.status(401);
        throw new Error ('Invalid Email or password')
    }
});

export const getProfile = asyncHandler( async(req, res) => {    
    const user = await user.findById(req.user._id);

    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
    });
});

export const updateProfile = asyncHandler( async(req, res) => {
    const user = await user.findById(req.user._id);

    if(user){
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;

        if (req.body.password){
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            token: generateToken(updatedUser._id)  

        });
    } else {
        res.status(404);
        throw new Error('user not Found');
    }
});