const parser = require("node-html-parser");
const fetch = require("node-fetch");
const { Client } = require("@notionhq/client");
const reader = require("./reader");
const { makeConsoleLogger } = require("@notionhq/client/build/src/logging");
const { search } = require("@notionhq/client/build/src/api-endpoints");
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dollarSign = "$";
const dotSign = ".";
const goodreadsStartingURL = "https://www.goodreads.com";
const amazonStartingURL = "https://www.amazon.com";
const NO_DATE = "January 1 1970";

function parseURL(url) {
    if (url.includes(amazonStartingURL)) {
        // Amazon
        url = url.replace("-ebook", "");
        url = url.replace("-audiobook", "");
        refIndex = url.indexOf("ref");
        if (refIndex != -1) {
            url = url.substring(0, refIndex);
        }
        tagIndex = url.indexOf("?tag");
        if (tagIndex != -1) {
            url = url.substring(0, tagIndex);
        }
        pdIndex = url.indexOf("?pd");
        if (pdIndex != -1) {
            url = url.substring(0, pdIndex);
        }
    }
    // Remove GET requests overall if nothing found (applies to both Amazon and Goodreads)
    questionMarkIndex = url.indexOf("?");
    if (questionMarkIndex != -1) {
        url = url.substring(0, questionMarkIndex);
    }
    return url;
}

function parseSearchIntoURL(bookTitle, isGoodreads) {
    bookTitle = bookTitle.replace(/[^\w -]/g, ""); // remove symbols and leave only alphabets or numbers
    bookTitle = bookTitle.replace(/-/g, " "); // replace dash with a whitespace
    bookTitle = bookTitle.replace(/  /g, " "); // remove 2 character whitespace to one
    bookTitle = bookTitle.replaceAll(" ", "+");
    if (isGoodreads == true) {
        bookTitle = "https://www.goodreads.com/search?q=" + bookTitle;
    } else {
        bookTitle = "https://www.amazon.com/s?k=" + bookTitle;
    }
    return bookTitle;
}

function parsePrice(htmlContent, prices, index) {
    var dotIndex = htmlContent.indexOf(dotSign, index);
    var dollarsIndex = htmlContent.substring(index + 1, dotIndex);
    var centsIndex = htmlContent.substring(dotIndex + 1, dotIndex + 3);
    var price = dollarsIndex + "." + centsIndex;
    if (dollarsIndex != "0") prices.push(parseFloat(price).toFixed(2));
    return prices;
}

function formatDate(date) {
    var d = new Date(date),
        month = "" + (d.getMonth() + 1),
        day = "" + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return [year, month, day].join("-");
}

var findTheme = function(text) {
    var themes = [
        "Self-help",
        "Self Help",
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
        "Biographies",
    ];

    tags = [];
    for (var i = 0; i < themes.length; i++) {
        if (text.includes(themes[i])) {
            tags.push(themes[i]);
        }
    }
    return tags;
};

function parseTags(textArray) {
    array = [];
    for (var i = 0; i < textArray.length; i++) {
        array.push({ name: textArray[i] });
    }
    return array;
}

const insertToDatabase = async(scrapper) =>
    notion.pages.create({
        parent: {
            database_id: process.env.DATABASE_ID,
        },
        properties: {
            Name: {
                title: [{
                    type: "text",
                    text: {
                        content: scrapper.bookTitle,
                    },
                }, ],
            },
            Writer: {
                rich_text: [{
                    type: "text",
                    text: {
                        content: scrapper.authorName,
                    },
                }, ],
            },
            "Amazon Popularity": {
                number: scrapper.amazonPopularity,
            },
            "Amazon URL": {
                url: scrapper.amazonUrl,
            },
            Price: {
                number: scrapper.price,
            },
            Tags: {
                multi_select: parseTags(scrapper.theme),
            },
            "Amazon Published Date": {
                date: {
                    start: scrapper.amazonPublishedDate,
                },
            },
            "Goodreads URL": {
                url: scrapper.goodreadsUrl,
            },
            "Goodreads Rating": {
                number: scrapper.goodreadsRatingValue,
            },
            "Goodreads Popularity": {
                number: scrapper.goodreadsPopularity,
            },
            "Goodreads Published Date": {
                date: {
                    start: scrapper.goodreadsPublishedDate,
                },
            },
            "Page Amount": {
                number: scrapper.pageAmount,
            },
        },
    });

// TODO: Allow for only one source to be import if the other is not valid for whatever reason? 🤔
const insertToDatabaseOnlyAmazon = async(scrapper) =>
    notion.pages.create({
        parent: {
            database_id: process.env.DATABASE_ID,
        },
        properties: {
            Name: {
                title: [{
                    type: "text",
                    text: {
                        content: scrapper.bookTitle,
                    },
                }, ],
            },
            Writer: {
                rich_text: [{
                    type: "text",
                    text: {
                        content: scrapper.authorName,
                    },
                }, ],
            },
            "Amazon Popularity": {
                number: scrapper.amazonPopularity,
            },
            "Amazon URL": {
                url: scrapper.amazonUrl,
            },
            Price: {
                number: scrapper.price,
            },
            Tags: {
                multi_select: parseTags(scrapper.theme),
            },
            "Amazon Published Date": {
                date: {
                    start: scrapper.amazonPublishedDate,
                },
            },
        },
    });

const insertToDatabaseOnlyGoodreads = async(scrapper) =>
    notion.pages.create({
        parent: {
            database_id: process.env.DATABASE_ID,
        },
        properties: {
            Name: {
                title: [{
                    type: "text",
                    text: {
                        content: scrapper.bookTitle,
                    },
                }, ],
            },
            Writer: {
                rich_text: [{
                    type: "text",
                    text: {
                        content: scrapper.authorName,
                    },
                }, ],
            },
            Tags: {
                multi_select: parseTags(scrapper.theme),
            },
            "Goodreads URL": {
                url: scrapper.goodreadsUrl,
            },
            "Goodreads Rating": {
                number: scrapper.goodreadsRatingValue,
            },
            "Goodreads Popularity": {
                number: scrapper.goodreadsPopularity,
            },
            "Goodreads Published Date": {
                date: {
                    start: scrapper.goodreadsPublishedDate,
                },
            },
            "Page Amount": {
                number: scrapper.pageAmount,
            },
        },
    });

function fetchBookInfoAmazon(root, url) {
    try {
        var bookTitle = root
            .querySelector("#productTitle")
            .textContent.replace(/&amp;/g, "&")
            .replace(/&#39;/g, "'")
            .replace(/\n/g, "");
    } catch (err) {
        var bookTitle = "";
    }

    try {
        var authorName = root.querySelector(".contributorNameID").textContent;
    } catch (err) {
        var authorName = "";
    }

    try {
        var amazonPopularity = root
            .querySelector("#acrCustomerReviewText")
            .textContent.replace(/\D/g, "");
        amazonPopularity = parseInt(amazonPopularity);
    } catch (err) {
        var amazonPopularity = 0;
    }

    try {
        var productDetailsElement = root
            .querySelector("#detailBullets_feature_div")
            .textContent.replace(/\n/g, "");
        var amazonPublishedDate = productDetailsElement.substring(
            productDetailsElement.indexOf("(") + 1,
            productDetailsElement.indexOf(")")
        );
        if (amazonPublishedDate.length !== 0) {
            amazonPublishedDate = formatDate(amazonPublishedDate);
        }
        // description = selector("td", "#detailsReleaseDate") -> consider this class if tak jumpa
    } catch (err) {
        var amazonPublishedDate = formatDate(NO_DATE);
    }

    try {
        var priceElement = root.querySelector("#tmmSwatches");
        if (priceElement == null)
            priceElement = root.querySelector("#mediaTabs_tabSet");

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

    try {
        var themeElement = root.querySelector(".zg_hrsr");
        themeTextContent = "";
        themeElement.childNodes.forEach(function(nodes) {
            themeTextContent += nodes.textContent.toString().replace(/\n/g, "");
        });
        var theme = findTheme(themeTextContent);
    } catch (err) {
        var theme = [];
    }

    return {
        amazonUrl: url,
        bookTitle,
        authorName,
        amazonPopularity,
        amazonPublishedDate,
        price,
        theme,
    };
}

function fetchBookInfoGoodreads(root, url) {
    try {
        var bookTitle = root
            .querySelector("#bookTitle")
            .textContent.replace(/&amp;/g, "&")
            .trim();
    } catch (err) {
        var bookTitle = "";
    }

    try {
        var authorName = root
            .querySelector("span[itemprop=name]")
            .textContent.replace(/&amp;/g, "&")
            .trim();
    } catch (err) {
        var authorName = "";
    }

    try {
        var goodreadsRatingValue = root
            .querySelector("span[itemprop=ratingValue]")
            .textContent.replace(/\n/g, "")
            .trim();
        goodreadsRatingValue = parseFloat(goodreadsRatingValue);
    } catch (err) {
        var goodreadsRatingValue = 0;
    }

    try {
        var goodreadsPopularity = root
            .querySelector("meta[itemprop=ratingCount]")
            .getAttribute("content");
        goodreadsPopularity = parseInt(goodreadsPopularity);
    } catch (err) {
        var goodreadsPopularity = 0;
    }

    try {
        var pageAmount = root
            .querySelector("span[itemprop=numberOfPages]")
            .textContent.replace(/\n/g, "")
            .split(" ")[0];
        pageAmount = parseInt(pageAmount);
    } catch (err) {
        var pageAmount = 0;
    }

    try {
        var element = root.querySelector("#details");
        var goodreadsPublishedDate = element
            .querySelectorAll("div[class=row]")[1]
            .textContent.split("\n")[2]
            .trim()
            .replace(/(?<=[0-9])(?:st|nd|rd|th)/g, "");

        if (goodreadsPublishedDate == "") {
            publishedDateElement = element
                .querySelectorAll("div[class=row]")[1]
                .textContent.split("\n");
            for (var i = 0; i < publishedDateElement.length; i++) {
                date = publishedDateElement[i];
                if (date.match(/\d/g)) {
                    date = date.trim();
                    date = date.substring(date.search(/[A-Z]/g));
                    date = date.replace(/(?<=[0-9])(?:st|nd|rd|th)/g, "");
                    date = date.replace(/[^a-zA-z0-9 ]/g, "");
                    goodreadsPublishedDate = date;
                    break;
                }
            }
        }
        goodreadsPublishedDate = formatDate(goodreadsPublishedDate);
    } catch (err) {
        var goodreadsPublishedDate = formatDate(NO_DATE);
    }

    try {
        var genresElement = root.querySelectorAll(".elementList");
        var genreTextContent = "";
        var genreCount = 0;
        for (var i = 0; i < genresElement.length; i++) {
            // Pick the first 3, and ignore the nonfiction/fiction genre.
            if (genreCount == 4) break;
            var genreElement = genresElement[i];
            var genre = genreElement.querySelector("a");
            genre = genre.textContent;
            if (genre.includes("fiction")) continue;
            genreTextContent += genre + " ";
            genreCount++;
        }
        var theme = findTheme(genreTextContent);
    } catch (err) {
        var theme = [];
    }

    return {
        goodreadsUrl: url,
        bookTitle,
        authorName,
        goodreadsRatingValue,
        goodreadsPopularity,
        pageAmount,
        goodreadsPublishedDate,
        theme,
    };
}

var searchOnAmazon = async(searchUrl) =>
    fetch(searchUrl)
    .then((res) => res.text())
    .then(function(html) {
        var root = parser.parse(html);
        try {
            var list = root.querySelector(
                ".s-main-slot.s-result-list.s-search-results.sg-row"
            );
            var urlElement = list.querySelector(
                "div[data-component-type=s-search-result]"
            );
            var aElement = urlElement.querySelectorAll("a");
            var resultingURL = amazonStartingURL;
            for (var element of aElement) {
                url = element.getAttribute("href");
                if (!url.includes("audiobook") && !url.includes("javascript:void")) {
                    resultingURL += url;
                    break; // pick the first non-audiobook link. For ebook, consider je lagi.
                }
            }

            return parseURL(resultingURL);
        } catch (err) {
            return "";
        }
    });

var searchOnGoodreads = async(searchUrl) =>
    fetch(searchUrl)
    .then((res) => res.text())
    .then(function(html) {
        var root = parser.parse(html);
        var resultingURL = "";
        try {
            var table = root.querySelector(".tableList");
            resultingURL += goodreadsStartingURL;
            var linksElement = table.querySelectorAll(".bookTitle");
            for (var linkElement of linksElement) {
                var link = linkElement.getAttribute("href");
                if (!link.includes("summary") || !link.includes("simplified")) {
                    // Avoid picking summary books as there are lots of them
                    resultingURL += link;
                    break;
                }
            }
        } catch (err) {
            // Not found? Try searching again with lesser keywords.
            var inputElement = root.querySelector("#search_query_main");
            var bookTitle = inputElement._rawAttrs.value;

            var words = bookTitle.split(" ");
            words.splice(-1, 2); // Remove one word at a time and search again
            var newSearchForm = words.join(" ");
            var goodreadsInput = parseSearchIntoURL(newSearchForm, true);
            return searchOnGoodreads(goodreadsInput);
        }

        return parseURL(resultingURL);
    });

async function querySearch(searchURL) {
    return searchURL.includes(goodreadsStartingURL) ?
        await searchOnGoodreads(searchURL) :
        await searchOnAmazon(searchURL);
}

// Fetch from Amazon and Goodreads and insert them to Notion, provided both URLs dah ada.
var fetchAndInsertBookInfos = async(amazonURL, goodreadsURL) =>
    Promise.all([fetch(amazonURL), fetch(goodreadsURL)])
    .then(function(responses) {
        return Promise.all(responses.map((res) => res.text()));
    })
    .then(function(html) {
        var theme = [];
        let bookInfos = {};

        var amazonHTML = html[0];
        var goodreadsHTML = html[1];

        var amazonRoot = parser.parse(amazonHTML);
        var goodreadsRoot = parser.parse(goodreadsHTML);

        amazonBookInfos = fetchBookInfoAmazon(amazonRoot, amazonURL);
        for (themeInAmazon of amazonBookInfos.theme) {
            if (!theme.includes(themeInAmazon)) theme.push(themeInAmazon);
        }
        bookInfos.amazonUrl = amazonBookInfos.amazonUrl;
        // bookInfos.authorName = amazonBookInfos.authorName
        bookInfos.amazonPopularity = amazonBookInfos.amazonPopularity;
        bookInfos.amazonPublishedDate = amazonBookInfos.amazonPublishedDate;
        bookInfos.price = amazonBookInfos.price;

        goodreadsBookInfos = fetchBookInfoGoodreads(goodreadsRoot, goodreadsURL);
        for (themeInGoodreads of goodreadsBookInfos.theme) {
            if (!theme.includes(themeInGoodreads)) theme.push(themeInGoodreads);
        }
        bookInfos.goodreadsUrl = goodreadsBookInfos.goodreadsUrl;
        bookInfos.authorName = goodreadsBookInfos.authorName;
        bookInfos.goodreadsRatingValue = goodreadsBookInfos.goodreadsRatingValue;
        bookInfos.goodreadsPopularity = goodreadsBookInfos.goodreadsPopularity;
        bookInfos.pageAmount = goodreadsBookInfos.pageAmount;
        bookInfos.goodreadsPublishedDate =
            goodreadsBookInfos.goodreadsPublishedDate;

        // For book title, pick the longer one
        goodreadsBookInfos.bookTitle.length > amazonBookInfos.bookTitle.length ?
            bookInfos.bookTitle = goodreadsBookInfos.bookTitle :
            bookInfos.bookTitle = amazonBookInfos.bookTitle

        bookInfos.theme = theme;
        return bookInfos;
    })
    .then(function(bookInfos) {
        console.log(bookInfos);
        insertToDatabase(bookInfos);
    });

// Finding URL from search result
var findBookURLFromSearchResult = async(amazonSearchUrl, goodreadsSearchUrl) =>
    Promise.all([searchOnAmazon(amazonSearchUrl), searchOnGoodreads(goodreadsSearchUrl)])
    .then(function(urlResultArray) {
        // Only allow to scrap if both URLs are obtained
        urlResultArray[0] != "" &&
            urlResultArray[1] != "" &&
            fetchAndInsertBookInfos(urlResultArray[0], urlResultArray[1]);
    });

var obtainBookURLFromOtherSource = async(bookURL) =>
    fetch(bookURL)
    .then((res) => res.text())
    .then(function(html) {
        var root = parser.parse(html);
        var originateFromAmazon = bookURL.includes(amazonStartingURL);

        if (originateFromAmazon) {
            try {
                var bookTitle = root
                    .querySelector("#productTitle")
                    .textContent.replace(/&amp;/g, "&")
                    .replace(/&#39;/g, "'")
                    .replace(/\n/g, "");
            } catch (err) {
                if (html.includes("not a robot")) {
                    console.log("Oh no, they know you're a robot!");
                }
                var bookTitle = "";
            }
        } else {
            var bookTitle = root
                .querySelector("#bookTitle")
                .textContent.replace(/&amp;/g, "&")
                .trim();
        }

        return parseSearchIntoURL(bookTitle, originateFromAmazon ? true : false);
    })
    .then((url) => {
        return querySearch(url);
    })
    .then(function(bookURL) {
        return bookURL.includes(goodreadsStartingURL) ? [bookURL, parseURL(bookURL)] : [parseURL(bookURL), bookURL];
    })
    .then(function(urlResultArray) {
        // Only allow scraping if both URLs are obtained
        urlResultArray[0] != "" &&
            urlResultArray[1] != "" &&
            fetchAndInsertBookInfos(urlResultArray[0], urlResultArray[1]);
    });

async function start(input) {
    if (input.includes("https://")) {
        // is a link
        await obtainBookURLFromOtherSource(input);
    } else {
        // not a link
        console.log("You searched for: " + input);
        var amazonSearchURL = parseSearchIntoURL(input, false);
        var goodreadsSearchURL = parseSearchIntoURL(input, true);
        await findBookURLFromSearchResult(amazonSearchURL, goodreadsSearchURL);
    }
}

var input = process.argv[2];
start(input);
reader.query()