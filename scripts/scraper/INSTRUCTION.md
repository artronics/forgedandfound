I'm designing a jewellery e-commerce website in Shopify. I want to create a tag and category system to classify my products. 
I'm using shopify headless, so this exercise is more about data modelling than the look of the website. 
For example, I can create many collections, but that doesn't mean it appears in the website menu. 
So think like you are modelling the domain (search, index, query, etc)

Category: Ring, Necklace, Earring, Bracelet, 
Materials: Gold, Silver, Vermeil, Gold Plated
Purity: 18ct, 14ct, 9ct, Sterling Silver

Also consider different dimensions for stones.
_____
I want to subcategories the product in two groups, "Style" and "Design"
I'm thinking "Design" are distinct physical characteristics. For example for necklaces: "Chocker", "Chain", "Lariat" etc
The "Style" is more subjective and cross category. For example "Vintage" "Chunky" etc.
______
For Shopify I want to represent the "Design" as collections and "Style" as tags. And both be used as filters.
______
Tasks:
First gather as much as data about what other brands are doing and what kind of vocabularies and terminology is used in other businesses, like:
https://mejuri.com/gb/en
https://www.monicavinader.com/
https://www.missoma.com/
https://www.brilliantearth.com
https://www.gabrielny.com/
https://www.davidyurman.com/en-gb
https://foundrae.com/

Search other popular brands especially in the UK.
Then expand my styles and designs to each category.
Come up with the most useful and common product dimensions. For each term find synonyms and decide which one should be the main one for 
our website. For example:
```markdown
### Chunky
    <Definitions and references>
#### Synonyms:
    Chunky
    Bold
    Oversized
    Statement
```
Write a file `CATEGORISATION.md` and create a summary of your findings. The terminology definitions with synonyms and
recommendation for shopify implementation.
Write it in such a way that the `scraper` can also classify products in a consistent way, so later we can map it to
actual products when it's being seeded to the shopify db. For example our terminology for a chunky ring is "Chunky",
so if a website calls it "Bold" then we register it as "Chunky".

Define a data model for it and create a json file. This json file can be used later for vectorisation of terms so we can find the 
best match during scraping.


