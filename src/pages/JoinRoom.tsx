import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const JoinRoom = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const code = String(roomCode || "").trim().toUpperCase();
    if (!code) {
      navigate("/", { replace: true });
      return;
    }
    navigate(`/?join=${encodeURIComponent(code)}`, { replace: true });
  }, [roomCode, navigate]);

  return <div className="min-h-screen flex items-center justify-center text-lg">Preparing invite…</div>;
};

export default JoinRoom;
