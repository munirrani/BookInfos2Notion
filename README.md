# BookInfos2Notion
A simple tool to import book product pages from Amazon and Goodreads into Notion note-taking app as a watchlist.
<br>

Made using Node.js JavaScript backend framework and Notion API client.
<br>

![](assets/images/demonstration.gif)

## Requirements
* Git
* Node.js.
* Your code editor of choice.

## Installation

1. Clone this repository.

2. Make sure to have Notion Node.js client, node-fetch and node-html-parser installed in this project folder:

    ```bash
    npm install @notionhq/client node-html-parser node-fetch
    ```

## Usage

### 1 . Setting up the environment

Create an integration in Notion. Then, in Notion, open your book database and grant permission for the integration to access it.

You can read exactly how in [Notion's API page](https://developers.notion.com/docs/getting-started).

---

Your Notion token and database should be kept locally inside your machine.

If you're on a Unix-based system, add these lines to your .bash_profile in home directory (if file doesn't exist, create one):

```bash
NOTION_TOKEN = {notion_token} # your notion token (starts with "secret_")
DATABASE_ID = {database_id} # your database id
```

For Windows you can execute these lines in PowerShell:
```powershell
$env:NOTION_TOKEN="{notion_token}" # your notion token (starts with "secret_")
$env:DATABASE_ID="{database_id}" # your database id
````
Be sure not to miss to put the token & ID inside the double quotation marks.

You can change the properties title name according to your book database items in ``scrapper.js`` 

If your book database have other property type than stated below, you can read more on [Page property value](https://developers.notion.com/reference/page#page-property-value).

```javascript
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
```

### 2. Use

In your current folder, run:

```bash
node scrapper.js "<link>"
```
