var parser = require('node-html-parser')
var fetch = require('node-fetch')
const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dollarSign = "$"
const dotSign = "."

function parsePrice(htmlContent, prices, index) {
    var dotIndex = htmlContent.indexOf(dotSign, index);
    var dollarsIndex = htmlContent.substring(index + 1, dotIndex);
    var centsIndex = htmlContent.substring(dotIndex + 1, dotIndex + 3);
    var price = dollarsIndex + "." + centsIndex;
    if (dollarsIndex != "0") prices.push(parseFloat(price).toFixed(2));
    return prices;
}

let bookInfos

var fetchLatestBookInfos = async(amazonURL, goodreadsURL) =>
    Promise.all([fetch(amazonURL), fetch(goodreadsURL)])
    .then(function(responses) {
        return Promise.all(responses.map((res) => res.text()));
    })
    .then(function(html) {
        // Fetch latest from Amazon
        var amazonHTML = html[0];
        var amazonRoot = parser.parse(amazonHTML)

        try {
            var amazonPopularity = amazonRoot
                .querySelector("#acrCustomerReviewText")
                .textContent.replace(/\D/g, "");
            amazonPopularity = parseInt(amazonPopularity);
        } catch (err) {
            var amazonPopularity = 0;
        }

        try {
            var priceElement = amazonRoot.querySelector("#tmmSwatches");
            if (priceElement == null)
                priceElement = amazonRoot.querySelector("#mediaTabs_tabSet");
    
            if (priceElement != null) {
                var priceElementTextContent = priceElement.textContent.replace(/\n/g, "");
                var pricesArray = [];
    
                var firstPriceIndex = priceElementTextContent.indexOf(dollarSign);
                pricesArray = parsePrice(
                    priceElementTextContent,
                    pricesArray,
                    firstPriceIndex
                );
                var nextPriceIndex = firstPriceIndex;
                var count = 1; // Find the first 3 prices je. The rest of the ones are likely to be used books.
                while (nextPriceIndex != -1 && count != 3) {
                    var nextPriceIndex = priceElementTextContent.indexOf(
                        dollarSign,
                        nextPriceIndex + 1
                    );
                    count++;
                    if (nextPriceIndex != -1) {
                        pricesArray = parsePrice(
                            priceElementTextContent,
                            pricesArray,
                            nextPriceIndex
                        );
                    }
                }
                var price = Math.min.apply(Math, pricesArray);
            }
        } catch (err) {
            var price = 0;
        }

        // Fetch latest from Goodreads
        var goodreadsHTML = html[1];
        var goodreadsRoot = parser.parse(goodreadsHTML)

        try {
            var goodreadsRatingValue = goodreadsRoot
                .querySelector("span[itemprop=ratingValue]")
                .textContent.replace(/\n/g, "")
                .trim();
            goodreadsRatingValue = parseFloat(goodreadsRatingValue);
        } catch (err) {
            var goodreadsRatingValue = 0;
        }

        try {
            var goodreadsPopularity = goodreadsRoot
                .querySelector("meta[itemprop=ratingCount]")
                .getAttribute("content");
            goodreadsPopularity = parseInt(goodreadsPopularity);
        } catch (err) {
            var goodreadsPopularity = 0;
        }
        bookInfos = {
            amazonPopularity,
            price,
            goodreadsRatingValue,
            goodreadsPopularity,
        }
    })

var query = async() => {

    var databaseQuery = await notion.databases.query({
        database_id: process.env.BOOK_WATCHLIST_DATABASE_ID,
    });
    var resultsArray = databaseQuery.results
    var idURLArray = []
    resultsArray.forEach(function(item) {
        var id = item.id
        var amazonURL = item.properties["Amazon URL"].url
        var goodreadsURL = item.properties["Goodreads URL"].url
        try {
            var amazonPopularity = item.properties["Amazon Popularity"].number
        } catch (err) {
            var amazonPopularity = 0
        }
        try {
            var price = item.properties["Price"].number
        } catch (err) {
            var price = 0
        }
        try {
            var goodreadsPopularity = item.properties["Goodreads Popularity"].number
        } catch (err) {
            var goodreadsPopularity = 0
        }
        try {
            var goodreadsRatingValue = item.properties["Goodreads Rating"].number
        } catch (err) {
            var goodreadsRatingValue = 0
        }
        idURLArray.push({ id, amazonURL, goodreadsURL, amazonPopularity, price, goodreadsPopularity, goodreadsRatingValue })
    })

    for (var i = 0; i < idURLArray.length; i++) {
        await fetchLatestBookInfos(idURLArray[i].amazonURL, idURLArray[i].goodreadsURL)
        if (bookInfos.amazonPopularity != 0) idURLArray[i].amazonPopularity = bookInfos.amazonPopularity
        if (bookInfos.price != 0) idURLArray[i].price = bookInfos.price
        if (bookInfos.goodreadsPopularity != 0) idURLArray[i].goodreadsPopularity = bookInfos.goodreadsPopularity
        if (bookInfos.goodreadsRatingValue != 0) idURLArray[i].goodreadsRatingValue = bookInfos.goodreadsRatingValue
        console.log("Book " + (i + 1) + " Scrapped. Details:")
        console.log(idURLArray[i])
    }

    for (var i = 0; i < idURLArray.length; i++) {
        pageId = idURLArray[i].id
        databaseQuery = await notion.pages.update({
            page_id: pageId,
            properties: {
                'Amazon Popularity': {
                    number: idURLArray[i].amazonPopularity
                },
                'Price': {
                    number: idURLArray[i].price
                },
                "Goodreads Rating": {
                    number: idURLArray[i].goodreadsRatingValue,
                },
                "Goodreads Popularity": {
                    number: idURLArray[i].goodreadsPopularity,
                },
            },
        });
        console.log(databaseQuery);
    }
};

exports.query = query