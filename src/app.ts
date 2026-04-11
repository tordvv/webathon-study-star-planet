import express from "express"
import path from "path"

const app = express();
const port = 3000

app.use(express.static(path.join(import.meta.dirname, "public")))

app.get("/", (req, res) => {
    res.status(200).sendFile("./index.html", {root: path.join(import.meta.dirname, "pages")})
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})