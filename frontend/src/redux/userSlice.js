import { createSlice } from '@reduxjs/toolkit'

const userSlice = createSlice({
  name: 'user',
  initialState: {
    authUser: {},
    otherUsers: [],
    selectedUser: null,
    onlineUsers: null,
  },
  reducers: {
    setauthUser: (state, action)=>{
      state.authUser = action.payload
      state.selectedUser = null; // reset selected user on login
    },
    setotherUsers: (state, action)=>{
      state.otherUsers = action.payload
    },
    setselectedUser: (state, action)=>{
      state.selectedUser = action.payload
    },
    setonlineUsers: (state, action)=>{
      state.onlineUsers = action.payload
    },
  },
});

export const {setauthUser, setotherUsers, setselectedUser, setonlineUsers} = userSlice.actions;

export default userSlice.reducer;