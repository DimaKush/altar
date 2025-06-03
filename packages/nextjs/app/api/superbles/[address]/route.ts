import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
    }
    
    const indexerApiUrl = process.env.INDEXER_API_URL || process.env.NEXT_PUBLIC_API_URL;
    
    if (!indexerApiUrl) {
      console.error('INDEXER_API_URL not set');
      return NextResponse.json({ error: "Indexer API URL not configured" }, { status: 500 });
    }
    
    const fullUrl = `${indexerApiUrl}/superbles/${address}`;
    console.log('Calling indexer at:', fullUrl);
    
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      console.error(`Indexer API error: ${response.status} ${response.statusText}`);
      throw new Error(`Indexer API returned status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Data from indexer:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching superbles deployments:', error);
    return NextResponse.json({ error: "Failed to fetch deployment data" }, { status: 500 });
  }
} 