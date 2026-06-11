const io = new Server(server, {
  cors: {
    origin: [
      "https://lms-project-beta-two.vercel.app/",   // URL frontend sau này
      "http://localhost:3000"                 // để test local
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});