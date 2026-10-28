import autocannon from "autocannon";

autocannon(
    {
        url: "http://localhost:4001/screenshot?url=https://example.com",
        connections: 2,           // Increased to match your pLimit(5)
        pipelining: 1,
        duration: 30,
        timeout: 60               // Give Puppeteer plenty of time to work
    },
    (err, result) => {
        if (err) console.error(err);
        console.log(result); // Log the raw result object
    }
);