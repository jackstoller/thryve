"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Upload, PlusCircle, ArrowLeft, Loader2 } from "lucide-react"

interface AddPlantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImageSelected: (file: File, name: string, location: string) => void
  onManualAdd: () => void
}

export function AddPlantModal({ open, onOpenChange, onImageSelected, onManualAdd }: AddPlantModalProps) {
  const [mode, setMode] = useState<"choice" | "image" | "basics">("choice")
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [plantName, setPlantName] = useState("")
  const [plantLocation, setPlantLocation] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Reset to choice mode whenever dialog opens
  useEffect(() => {
    if (open) {
      setMode("choice")
      setSelectedFile(null)
      setPreview(null)
      setPlantName("")
      setPlantLocation("")
      setIsProcessing(false)
    }
  }, [open])

  const handleFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
      setMode("basics")
      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (cameraInputRef.current) cameraInputRef.current.value = ""
    }
  }

  const handleSubmitBasics = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !plantName || !plantLocation) return
    
    setIsProcessing(true)
    try {
      await onImageSelected(selectedFile, plantName, plantLocation)
      onOpenChange(false)
    } catch (error) {
      setIsProcessing(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false)
    }
  }

  const handleManualClick = () => {
    onManualAdd()
    onOpenChange(false)
  }

  const handleBack = () => {
    if (mode === "basics") {
      setMode("image")
      setSelectedFile(null)
      setPreview(null)
      setPlantName("")
      setPlantLocation("")
    } else if (mode === "image") {
      setMode("choice")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(mode === "image" || mode === "basics") && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-2"
                onClick={handleBack}
                disabled={isProcessing}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Add a New Plant
          </DialogTitle>
        </DialogHeader>

        {mode === "choice" ? (
          <div className="flex flex-col gap-4 py-4">
            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-3"
              onClick={() => setMode("image")}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-1">Identify from Photo</p>
                <p className="text-sm text-muted-foreground">
                  AI will identify and suggest care requirements
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-3"
              onClick={handleManualClick}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <PlusCircle className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-1">Add Manually</p>
                <p className="text-sm text-muted-foreground">
                  Enter all plant details yourself
                </p>
              </div>
            </Button>
          </div>
        ) : mode === "image" ? (
          <div
            className={`
              border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${dragActive ? "border-primary bg-primary/5" : "border-border"}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-medium mb-1">Take or upload a photo</p>
                <p className="text-sm text-muted-foreground">
                  Our AI will identify your plant and find its care requirements
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitBasics} className="space-y-4">
            {preview && (
              <div className="relative rounded-lg overflow-hidden">
                <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="plant-name">Plant Name *</Label>
              <Input
                id="plant-name"
                placeholder="e.g., My Snake Plant"
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
                required
                disabled={isProcessing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plant-location">Location *</Label>
              <Input
                id="plant-location"
                placeholder="e.g., Living Room, Bedroom Window"
                value={plantLocation}
                onChange={(e) => setPlantLocation(e.target.value)}
                required
                disabled={isProcessing}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleBack} 
                disabled={isProcessing}
                className="flex-1"
              >
                Back
              </Button>
              <Button type="submit" disabled={isProcessing} className="flex-1">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Identify Plant"
                )}
              </Button>
            </div>
          </form>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </DialogContent>
    </Dialog>
  )
}
