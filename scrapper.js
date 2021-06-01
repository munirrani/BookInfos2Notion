const parser = require('node-html-parser')
const fetch = require('node-fetch')
const { Client } = require('@notionhq/client');
const reader = require("./reader")
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dollarSign = "$"
const dotSign = "."

function parseURL(url) {
    url = url.replace("-ebook", "")
    refIndex = url.indexOf("ref")
    if (refIndex != -1) {
        url = url.substring(0, refIndex)
    }
    tagIndex = url.indexOf("?tag")
    if (tagIndex != -1) {
        url = url.substring(0, tagIndex)
    }
    pdIndex = url.indexOf("?pd")
    if (pdIndex != -1) {
        url = url.substring(0, pdIndex)
    }
    return url
}

function parsePrice(htmlContent, prices, index) {
    var dotIndex = htmlContent.indexOf(dotSign, index)
    var dollarsIndex = htmlContent.substring(index + 1, dotIndex)
    var centsIndex = htmlContent.substring(dotIndex + 1, dotIndex + 3)
    var price = dollarsIndex + "." + centsIndex
    if (dollarsIndex != "0") prices.push(parseFloat(price).toFixed(2))
    return prices
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

var findTheme = function(text) {
    var themes = [
        "Self-help",
        "Politics",
        "World",
        "Philosophy",
        "Physics",
        "History",
        "Psychology",
        "Productivity",
        "Mathematics",
        "Social Science",
        "Computer",
        "Artificial Intelligence",
        "Economics",
        "Finance",
        "Business",
        "Technology",
        "Reference",
        "Engineering",
        "Software",
        "Programming",
        "Machine Learning",
        "Malaysia",
        "Leadership",
        "Trading",
        "Child",
        "Islam",
        "Web",
        "Hardware",
        "Security",
        "Design",
        "Operating Systems",
        "Biographies"
    ]

    tags = []
    for (var i = 0; i < themes.length; i++) {
        if (text.includes(themes[i])) {
            tags.push(themes[i])
        }
    }
    return tags
}

function parseTags(textArray) {
    array = []
    for (var i = 0; i < textArray.length; i++) {
        array.push({ "name": textArray[i] })
    }
    return array
}

const insertToDatabase = async(scrapper) => notion.pages.create({
    parent: {
        database_id: process.env.DATABASE_ID,
    },
    properties: {
        'Name': {
            title: [{
                type: 'text',
                text: {
                    content: scrapper.bookTitle,
                },
            }, ],
        },
        'Writer': {
            rich_text: [{
                type: 'text',
                text: {
                    content: scrapper.authorName,
                },
            }, ],
        },
        'Popularity': {
            number: scrapper.popularity
        },
        'URL': {
            url: scrapper.url
        },
        'Price': {
            number: scrapper.price
        },
        "Tags": {
            "multi_select": parseTags(scrapper.theme)
        },
        "Published Date": {
            "date": {
                start: scrapper.date
            }
        }
    },
});

let bookInfos

var scrapStream = async(url) => fetch(url)
    .then(res => res.text())
    .then(function(html) {
        var root = parser.parse(html)

        var bookTitle = root.querySelector('#productTitle')
            .textContent
            .replace(/&amp;/g, '&')

        var authorName = root.querySelector(".contributorNameID")
            .textContent

        var popularity = root.querySelector("#acrCustomerReviewText")
            .textContent
            .replace(/\D/g, "")
        popularity = parseInt(popularity)

        var productDetailsElement = root.querySelector("#detailBullets_feature_div")
            .textContent
            .replace(/\n/g, "")
        var date = productDetailsElement.substring(productDetailsElement.indexOf("(") + 1, productDetailsElement.indexOf(")"))
        if (date.length !== 0) {
            date = formatDate(date)
        }
        // description = selector("td", "#detailsReleaseDate") -> consider this class if tak jumpa

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

        var themeElement = root.querySelector(".zg_hrsr")
        themeTextContent = ""
        themeElement.childNodes.forEach(function(nodes) {
            themeTextContent += nodes.textContent.toString().replace(/\n/g, "")
        })
        var theme = findTheme(themeTextContent)

        bookInfos = {
            url,
            bookTitle,
            authorName,
            popularity,
            date,
            price,
            theme
        }
    })
    .finally(function() {
        insertToDatabase(bookInfos)
    })

var url = process.argv[2]
url = parseURL(url)
scrapStream(url)
reader.query()