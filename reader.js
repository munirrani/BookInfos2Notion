var parser = require('node-html-parser')
var fetch = require('node-fetch')
const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dollarSign = "$"
const dotSign = "."

function parsePrice(htmlContent, prices, index) {
    var dotIndex = htmlContent.indexOf(dotSign, index)
    var dollarsIndex = htmlContent.substring(index + 1, dotIndex)
    var centsIndex = htmlContent.substring(dotIndex + 1, dotIndex + 3)
    var price = dollarsIndex + "." + centsIndex
    if (dollarsIndex != "0") prices.push(parseFloat(price).toFixed(2))
    return prices
}

let bookInfos

var scrapStream = async(url) => fetch(url)
    .then(res => res.text())
    .then(function(html) {
        var root = parser.parse(html)

        var popularity = root.querySelector("#acrCustomerReviewText")
            .textContent
            .replace(/\D/g, "")
        popularity = parseInt(popularity)

        var priceElement = root.querySelector("#tmmSwatches")
        if (priceElement == null) priceElement = root.querySelector("#mediaTabs_tabSet")

        if (priceElement != null) {
            var priceElementTextContent = priceElement.textContent.replace(/\n/g, "")
            var pricesArray = []

            var firstPriceIndex = priceElementTextContent.indexOf(dollarSign)
            pricesArray = parsePrice(priceElementTextContent, pricesArray, firstPriceIndex)
            var nextPriceIndex = firstPriceIndex
            var count = 1 // Find the first 3 prices je. The rest of the ones are likely to be used books.
            while (nextPriceIndex != -1 && count != 3) {
                var nextPriceIndex = priceElementTextContent.indexOf(dollarSign, nextPriceIndex + 1)
                count++
                if (nextPriceIndex != -1) {
                    pricesArray = parsePrice(priceElementTextContent, pricesArray, nextPriceIndex)
                }
            }
            var price = Math.min.apply(Math, pricesArray)
        } else {
            var price = null
        }

        bookInfos = {
            popularity,
            price
        }
    })

var query = async() => {

    var databaseQuery = await notion.databases.query({
        database_id: process.env.DATABASE_ID,
    });
    var resultsArray = databaseQuery.results
    var idURLArray = []
    resultsArray.forEach(function(item) {
        var id = item.id
        var url = item.properties.URL.url
        idURLArray.push({ id, url })
    })

    for (var i = 0; i < idURLArray.length; i++) {
        await scrapStream(idURLArray[i].url)
        idURLArray[i].popularity = bookInfos.popularity
        idURLArray[i].price = bookInfos.price
        console.log("Book " + (i + 1) + " Scrapped. Details:")
        console.log(idURLArray[i])
    }

    for (var i = 0; i < idURLArray.length; i++) {
        pageId = idURLArray[i].id
        databaseQuery = await notion.pages.update({
            page_id: pageId,
            properties: {
                'Popularity': {
                    number: idURLArray[i].popularity
                },
                'Price': {
                    number: idURLArray[i].price
                }
            },
        });
        console.log(databaseQuery);
    }
};

exports.query = query