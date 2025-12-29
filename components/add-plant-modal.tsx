"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Upload, PlusCircle, ArrowLeft, Loader2, Shuffle } from "lucide-react"
import { getRandomPlantName } from "@/lib/plant-names"

interface AddPlantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImageSelected: (files: File[], name: string, location: string) => void
  onManualAdd: () => void
}

export function AddPlantModal({ open, onOpenChange, onImageSelected, onManualAdd }: AddPlantModalProps) {
  const [mode, setMode] = useState<"choice" | "image" | "basics">("choice")
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [plantName, setPlantName] = useState("")
  const [plantLocation, setPlantLocation] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Reset to choice mode whenever dialog opens
  useEffect(() => {
    if (open) {
      setMode("choice")
      setSelectedFiles([])
      setPreviews([])
      setPlantName("")
      setPlantLocation("")
      setIsProcessing(false)
    }
  }, [open])

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"))
    if (fileArray.length === 0) return

    setSelectedFiles(fileArray)
    
    // Generate previews for all files
    const previewPromises = fileArray.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })
    })

    Promise.all(previewPromises).then(previews => {
      setPreviews(previews)
      setMode("basics")
    })

    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }

  const handleFile = (file: File) => {
    handleFiles([file])
  }

  const handleSubmitBasics = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0 || !plantName || !plantLocation) return
    
    setIsProcessing(true)
    try {
      await onImageSelected(selectedFiles, plantName, plantLocation)
      // Reset form state on success
      setMode("choice")
      setSelectedFiles([])
      setPreviews([])
      setPlantName("")
      setPlantLocation("")
      setIsProcessing(false)
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
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

  const handleAutoName = () => {
    const randomName = getRandomPlantName()
    setPlantName(randomName)
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(mode === "image" || mode === "basics") && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 mr-1 active:scale-95"
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
          <div className="flex flex-col gap-3 py-2">
            <Button
              variant="outline"
              className="h-auto py-5 flex-col gap-2.5 active:scale-[0.98] transition-transform"
              onClick={() => setMode("image")}
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-0.5 text-sm">Identify from Photo</p>
                <p className="text-xs text-muted-foreground">
                  AI will identify and suggest care requirements
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-5 flex-col gap-2.5 active:scale-[0.98] transition-transform"
              onClick={handleManualClick}
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                <PlusCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-0.5 text-sm">Add Manually</p>
                <p className="text-xs text-muted-foreground">
                  Enter all plant details yourself
                </p>
              </div>
            </Button>
          </div>
        ) : mode === "image" ? (
          <div
            className={`
              border-2 border-dashed rounded-xl p-6 text-center transition-colors
              ${dragActive ? "border-primary bg-primary/5" : "border-border"}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-medium mb-1 text-sm">Take or upload a photo</p>
                <p className="text-xs text-muted-foreground">
                  Our AI will identify your plant and find its care requirements
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <Button 
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 active:scale-95"
                  size="sm"
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  Take Photo
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 active:scale-95"
                  size="sm"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  Upload
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitBasics} className="space-y-3">
            {previews.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative rounded-lg overflow-hidden">
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover" />
                      {index === 0 && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                          Cover
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {previews.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {previews.length} photos selected. First photo will be the cover.
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="plant-name" className="text-sm">Plant Name *</Label>
              <div className="flex gap-2">
                <Input
                  id="plant-name"
                  placeholder="e.g., My Snake Plant"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                  className="flex-1 h-10"
                  required
                  disabled={isProcessing}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoName}
                  disabled={isProcessing}
                  className="shrink-0 h-10"
                  title="Generate a random plant name"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plant-location" className="text-sm">Location *</Label>
              <Input
                id="plant-location"
                placeholder="e.g., Living Room, Bedroom Window"
                value={plantLocation}
                onChange={(e) => setPlantLocation(e.target.value)}
                required
                disabled={isProcessing}
                className="h-10"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleBack} 
                disabled={isProcessing}
                className="flex-1 active:scale-95"
                size="sm"
              >
                Back
              </Button>
              <Button 
                type="submit" 
                disabled={isProcessing} 
                className="flex-1 active:scale-95"
                size="sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
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
          multiple
          className="hidden"
          onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
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
