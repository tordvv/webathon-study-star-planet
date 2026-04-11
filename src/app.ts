import express from "express"
import path from "path"
import fs from "fs"

const app = express();
const port = 3000

app.use(express.json())
app.use(express.static(path.join(process.cwd(), "src", "public")))

const scoreFile = path.join(process.cwd(), "score.json")

app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "src", "pages", "index.html"))
})

app.get("/score", (req, res) => {
    if (fs.existsSync(scoreFile)) {
        const data = fs.readFileSync(scoreFile, "utf-8")
        res.json(JSON.parse(data))
    } else {
        res.json({ score: 0 })
    }
})

app.post("/score", (req, res) => {
    const { score } = req.body
    fs.writeFileSync(scoreFile, JSON.stringify({ score }))
    res.json({ success: true })
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})