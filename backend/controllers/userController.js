import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { io } from "../socket/socket.js";

dotenv.config({ quiet: true });

export const register = async (req, res) => {
  try {
    const { fullName, userName, password, confirmPassword, gender } = req.body;
    if (!fullName || !userName || !password || !confirmPassword || !gender) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    const user = await User.findOne({ userName });
    if (user) {
      return res.status(400).json({ message: "Username already exists." });
    }
    // const hashedPassword = bcrypt.hash(password, 10);
    const avatarSeeds = [
      "Emery",
      "Jade",
      "Ryan",
      "Riley",
      "Valentina",
      "Eliza",
      "Jessica",
      "Sophia",
      "Kimberly",
      "Christopher",
      "Kingston",
      "Alexander",
      "Liliana",
      "Avery",
      "Luis",
      "Jameson",
      "Andrea",
      "Ryker",
      "Robert",
      "Sawyer",
    ];
    function getRandomSeed() {
      const randomIndex = Math.floor(Math.random() * avatarSeeds.length);
      return avatarSeeds[randomIndex];
    }
    function getRandomAvatar() {
      const seed = getRandomSeed();
      return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}`;
    }
    const profilePhoto = getRandomAvatar();
    await User.create({
      fullName: fullName,
      userName: userName,
      password: password,
      profilePhoto: profilePhoto,
      gender: gender,
    });
    return res
      .status(201)
      .json({ message: "Account Created Successfully", success: true });
  } catch (error) {
    console.log(error);
  }
};

export const login = async (req, res) => {
  try {
    const { userName, password } = req.body;
    if (!userName || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }
    const user = await User.findOne({ userName });
    if (!user || password !== user.password) {
      return res
        .status(400)
        .json({ message: "Incorrect username or password", success: false });
    }

    const tokenData = {
      userID: user._id,
    };
    const token = jwt.sign(tokenData, process.env.JWT_SECRET_KEY, {
      expiresIn: "1d",
    });

    return res
      .status(200)
      .cookie("token", token, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "strict",
      })
      .json({
        _id: user._id,
        userName: user.userName,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto,
        success: true,
        message: `Logged in to ${user.userName}`,
      });
  } catch (error) {
    console.log(error);
  }
};

export const logout = (req, res) => {
  try {
    res.status(200).cookie("token", "", { maxAge: 0 }).json({
      message: "Logged-Out Successfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
};

export const getOtherUsers = async (req, res) => {
  try {
    const loggedInUserId = req.id;
    const otherUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");
    io.emit("otherUsers", otherUsers);
    return res.status(200).json(otherUsers);
  } catch (error) {
    console.log(error);
  }
};
