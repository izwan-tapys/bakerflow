import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { image, shoppingList } = await req.json(); // image and list for matching
    if (!image) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are a receipt scanning expert for a bakery. 
      Analyze this receipt image and extract items that match this shopping list: 
      ${JSON.stringify(shoppingList)}

      Return ONLY a JSON array of objects with these exact keys:
      - id (the ID from the shopping list that matches, or null if no match)
      - item (the name from the receipt)
      - qty (the numerical quantity bought. If the shopping list item has a pack_size, return the number of packs/units bought, NOT the total weight)
      - price (the total price paid for that item/line)

      Example output: [{"id": "123", "item": "Sauh Flour", "qty": 2, "price": 15.50}]
      Only include items that you are confident about.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: image.split(",")[1],
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Clean the AI response to get valid JSON
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonStr);

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
