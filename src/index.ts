import express from "express"

const app = express();
const port = 3000

app.get("/", (req, res) => {
    res.send("Hello StudyStarPlanet!")
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})