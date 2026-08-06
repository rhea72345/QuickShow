import React from "react";
import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const Loading= () => {
  const { nextUrl } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get("session_id")

  useEffect(()=>{
    if(nextUrl){
      setTimeout(()=>{
        const query = sessionId ? `?session_id=${sessionId}` : ""
        navigate(`/${nextUrl}${query}`)
      },8000)
    }
  },[nextUrl, navigate, sessionId])
  return (
    <div className='flex justify-center items-center h-[80vh]'>
        <div className='animate-spin rounded-full h-14 w-14 border-2
        border-t-primary'></div>

    </div>
  )
}

export default Loading