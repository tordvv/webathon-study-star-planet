import express from "express"

const app = express();
const port = 3000

app.use(express.static("./public"))

app.get("/", (req, res) => {
    res.send("Hello StudyStarPlanet!")
    //res.status(200).render("pages/index.html")
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})