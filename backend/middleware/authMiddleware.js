import jwt from 'jsonwebtoken';
import user from '../models/User'
import asyncaHandler from 'express-async-handler';

export const protect = asyncHandler(async (req, res, next) => {

    let token;         //authorization:    bearer <token>

    if( req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        try{
                // get actual token from header     split bearer token lab bearer ena token
            token = req.headers.authorization.split(' ')[1];

            //verify token, still valid mukanu mefletii
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            //users from token Megneyi b If from decode lkone token
            req.user = await user.findBYId(decoded.id).select('-password');

            next();

        }catch (error) {
            console.error(error);
            res.status(401);
            throw new Error ('Not authorized, token failed');
        }
    }
    if (!token) {
        res.status(401);
        throw new Error('No token');
    }
});

export const admin = (req, res, next) => {
     if (req.user && req.user.role === 'admin'){ 
        next();
     }else {
        res.status(403);
        throw new Error('Not admin');
     }
};