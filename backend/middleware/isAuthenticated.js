import jwt from "jsonwebtoken";
import dotenv from "dotenv"
dotenv.config({quiet: true});

const isAuthenticated = async(req, res, next) => {
    try{
        const token = req.cookies.token;
        if(!token){
            return res.status(401).json({message: "User not Authenticated."})
        };
        const decode = jwt.verify(token, process.env.JWT_SECRET_KEY); // decode = tokenData
        if(!decode){
            return res.status(401).json({message: "Invalid Token."})
        };
        // console.log(decode);
        req.id = decode.userID;
        next();
    }catch(error){
        console.log(error);
    }
};

export default isAuthenticated;