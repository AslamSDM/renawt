import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/recordings/[id]
 * Get a specific recording
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const recording = await prisma.screenRecording.findUnique({
      where: { id }
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ recording });

  } catch (error) {
    console.error("[API] Failed to get recording:", error);
    return NextResponse.json(
      { error: "Failed to get recording" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/recordings/[id]
 * Update recording settings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      trimStart,
      trimEnd,
      zoomPoints,
      featureName,
      description,
      cursorStyle
    } = body;

    const recording = await prisma.screenRecording.update({
      where: { id },
      data: {
        ...(trimStart !== undefined && { trimStart }),
        ...(trimEnd !== undefined && { trimEnd }),
        ...(zoomPoints !== undefined && { zoomPoints: JSON.stringify(zoomPoints) }),
        ...(featureName !== undefined && { featureName }),
        ...(description !== undefined && { description }),
        ...(cursorStyle !== undefined && { cursorStyle })
      }
    });

    return NextResponse.json({ 
      success: true,
      recording 
    });

  } catch (error) {
    console.error("[API] Failed to update recording:", error);
    return NextResponse.json(
      { error: "Failed to update recording" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recordings/[id]
 * Delete a recording
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.screenRecording.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true,
      message: "Recording deleted" 
    });

  } catch (error) {
    console.error("[API] Failed to delete recording:", error);
    return NextResponse.json(
      { error: "Failed to delete recording" },
      { status: 500 }
    );
  }
}
