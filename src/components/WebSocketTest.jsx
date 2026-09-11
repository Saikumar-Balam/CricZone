import  { useEffect } from 'react'
import {io} from "socket.io-client"


const WebSocketTest = () => {
    useEffect(() =>{
        const socket = io("http://localhost:5000")
        socket.on("connect", () => {
            console.log("Socket connected:", socket.id)

            socket.emit("join-match", 2)
        })

        socket.on("BALL_RECORDED", (payload) => {
            console.log("Live ball update:", payload)
        })


        socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason)
        })

        return () => {
            socket.emit("leave-match", 2)

            socket.off("connect")
            socket.off("BALL_RECORDED")
            socket.off("disconnect")
            socket.disconnect()
        }
    }, [])

  return (
    <div>
      WebSocket Test
    </div>
  )
}

export default WebSocketTest
