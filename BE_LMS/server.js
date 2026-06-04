const io = new Server(server, {
  cors: {
    origin: [
      "https://ten-app-frontend.vercel.app",   // URL frontend sau này
      "http://localhost:3000"                 // để test local
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});