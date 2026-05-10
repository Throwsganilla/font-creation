/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import * as opentype from 'opentype.js';
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Type, AlertCircle, Type as TypeIcon, Wand2, SlidersHorizontal, Sparkles, Shuffle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface FontAnalysis {
  familyName: string;
  subfamilyName: string;
  fullName: string;
  version: string;
  designer: string;
  copyright: string;
  manufacturer: string;
  license: string;
  numGlyphs: number;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [activeTab, setActiveTab] = useState<'package' | 'design'>('package');

  // Package Tab State
  const [file, setFile] = useState<File | null>(null);
  const [fontDetails, setFontDetails] = useState<FontAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewText, setPreviewText] = useState('Sphinx of black quartz, judge my vow.');
  const [previewPathData, setPreviewPathData] = useState<string>('');
  const [previewViewBox, setPreviewViewBox] = useState<string>('0 -20 800 100');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<opentype.Font | null>(null);

  // Design Tab State
  const [thickness, setThickness] = useState(50);
  const [proportion, setProportion] = useState(50);
  const [shape, setShape] = useState(50);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const updatePreview = (text: string, font: opentype.Font) => {
    if (!text) {
      setPreviewPathData('');
      return;
    }
    try {
      const fontSize = 48;
      // Enable rendering of specific OpenType features like ligatures
      const options = {
        features: {
          liga: true,
          rlig: true,
          dlig: true,
          calt: true
        }
      };
      const path = font.getPath(text, 0, fontSize, fontSize, options);
      const bbox = path.getBoundingBox();
      
      const pad = 10;
      const x = (bbox.x1 || 0) - pad;
      const y = (bbox.y1 || 0) - pad;
      const width = (bbox.x2 || 0) - (bbox.x1 || 0) + (pad * 2);
      const height = (bbox.y2 || 0) - (bbox.y1 || 0) + (pad * 2);

      if (width > 0 && height > 0) {
        setPreviewViewBox(`${x} ${y} ${width} ${height}`);
        setPreviewPathData(path.toPathData(2));
      } else {
        setPreviewPathData('');
      }
    } catch (err) {
      console.error("Error generating path data", err);
    }
  };

  useEffect(() => {
    if (fontRef.current) {
      updatePreview(previewText, fontRef.current);
    }
  }, [previewText]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setFontDetails(null);
    setPreviewPathData('');
    fontRef.current = null;
    setIsProcessing(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const font = opentype.parse(arrayBuffer);
      fontRef.current = font;
      
      const getNames = (nameObj: any) => nameObj && (nameObj.en || Object.values(nameObj)[0]) || 'Unknown';
      
      const details: FontAnalysis = {
        familyName: getNames(font.names.fontFamily),
        subfamilyName: getNames(font.names.fontSubfamily),
        fullName: getNames(font.names.fullName),
        version: getNames(font.names.version),
        designer: getNames(font.names.designer),
        copyright: getNames(font.names.copyright),
        manufacturer: getNames(font.names.manufacturer),
        license: getNames(font.names.license),
        numGlyphs: font.numGlyphs
      };
      
      setFontDetails(details);
      updatePreview(previewText, font);
    } catch (err) {
      console.error(err);
      setError("Failed to parse font file. Please ensure it's a valid TTF or OTF file.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGenerateSampleText = () => {
    const samples = [
      "Sphinx of black quartz, judge my vow.",
      "The quick brown fox jumps over the lazy dog. 0123456789",
      "Pack my box with five dozen liquor jugs. ¿¡ «» € £ ¥",
      "ABCDEFGHIJKLM NOPQRSTUVWXYZ abcdefghijklm nopqrstuvwxyz",
      "1234567890 ‹«»› „“”‚‘’ !?@#$%^&*()_+={}|[]\\;':\",./<>?",
      "C'est la vie! ¿Cómo estás? Grüße aus München!",
      "fi fl ffi ffl st ae oe AE OE ﬀ ﬁ ﬂ ﬃ ﬄ ﬆ"
    ];
    let nextIndex = samples.indexOf(previewText) + 1;
    if (nextIndex >= samples.length) nextIndex = 0;
    setPreviewText(samples[nextIndex]);
  };

  const generatePackage = async () => {
    if (!file || !fontDetails) return;

    try {
      const zip = new JSZip();
      
      zip.file(file.name, file);
      
      const readmeContent = `Font Analysis Report
====================

File: ${file.name}

Metadata:
---------
Family Name: ${fontDetails.familyName}
Subfamily:   ${fontDetails.subfamilyName}
Full Name:   ${fontDetails.fullName}
Version:     ${fontDetails.version}
Glyphs:      ${fontDetails.numGlyphs}

Credits & Legal:
----------------
Designer:     ${fontDetails.designer}
Manufacturer: ${fontDetails.manufacturer}
Copyright:    ${fontDetails.copyright}
License:      ${fontDetails.license}

Generated by Font Studio.
`;
      zip.file("README.txt", readmeContent);
      
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fontDetails.familyName.replace(/\s+/g, "_")}_Package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate zip package.");
    }
  };

  const handleDesignGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setGeneratedSvg(null);

    try {
      const prompt = `You are an expert typography designer and SVG developer. 
Create an SVG image demonstrating the letters "Aa Bb Cc Dd" for a newly designed font based on the following parameters.

Font Characteristics:
- Thickness/Weight: ${thickness} (0=Hairline/Very Thin, 100=Black/Very Heavy)
- Capital to lowercase proportion (x-height): ${proportion} (0=Tiny lowercase letters, 100=Lowercase letters as tall as capitals)
- Shape: ${shape} (0=Very angular, blocky, squared, 100=Very rounded, soft, curved)
- Additional design instructions from the user: "${aiPrompt || 'None'}"

Requirements:
- Return ONLY valid SVG code. No markdown formatting, no explanations, no HTML tags enclosing it.
- Use <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg"> as the root.
- Use explicit <path> elements to draw the letters. DO NOT use the <text> element with standard fonts because we want a custom, original design based on the parameters.
- Ensure the paths visually align with the thickness, proportion, and shape requested.
- Make the text fill color white (#ffffff).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt
      });
      
      let svgText = response.text || "";
      // Clean up markdown block if present
      svgText = svgText.replace(/```xml/g, '').replace(/```svg/g, '').replace(/```/g, '').trim();
      
      if (svgText.startsWith('<svg')) {
        setGeneratedSvg(svgText);
      } else {
        throw new Error("Invalid format returned by AI.");
      }

    } catch(e) {
      console.error(e);
      setGenerateError("Failed to generate font preview. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-8 flex flex-col items-center justify-start font-sans overflow-y-auto">
      <div className="w-full max-w-3xl mb-8 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-2">
          <TypeIcon className="w-8 h-8 text-neutral-300" />
          <h1 className="text-4xl font-medium tracking-tight text-white">Font Studio</h1>
        </div>
        <p className="text-neutral-400">Analyze, package, and creatively design typography.</p>
      </div>

      <div className="w-full max-w-3xl bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden mb-12">
        <div className="flex border-b border-neutral-700 bg-neutral-900 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('package')} 
            className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'package' ? 'bg-neutral-800 text-white border-t-2 border-t-blue-500' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'}`}
          >
            <Upload className="w-4 h-4" />
            Analyze & Package Font
          </button>
          <button 
            onClick={() => setActiveTab('design')} 
            className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'design' ? 'bg-neutral-800 text-white border-t-2 border-t-emerald-500' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'}`}
          >
            <Wand2 className="w-4 h-4" />
            AI Font Designer
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'package' && (
            <div className="animate-in fade-in duration-300">
              <p className="text-neutral-400 mb-6 text-sm">Upload a TTF or OTF font to analyze its metadata and generate a redistributable package with a README.</p>
              
              <div 
                className="border-2 border-dashed border-neutral-600 rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-neutral-400 hover:bg-neutral-700/30 transition-colors mb-6"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-neutral-400 mb-4" />
                <p className="text-neutral-200 font-medium mb-1">Click to upload or drag and drop</p>
                <p className="text-neutral-500 text-sm">TTF or OTF files only</p>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".ttf,.otf" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-200 p-4 rounded-lg flex items-start gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {isProcessing && (
                <div className="text-center py-8 text-neutral-400 animate-pulse">
                  Analyzing font file...
                </div>
              )}

              {fontDetails && !isProcessing && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                  <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-white">
                        <TypeIcon className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-lg font-medium">Glyph Preview</h2>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-6">
                      <input
                        type="text"
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        placeholder="Type to preview..."
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 focus:outline-none focus:border-neutral-500 text-neutral-200"
                      />
                      <button
                        onClick={handleGenerateSampleText}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm font-medium transition-colors text-neutral-300 whitespace-nowrap"
                        title="Generate diverse sample text"
                      >
                        <Shuffle className="w-4 h-4" />
                        Sample Text
                      </button>
                    </div>

                    <div className="w-full overflow-x-auto bg-neutral-950 rounded-lg p-6 flex justify-center items-center min-h-[140px] custom-scrollbar">
                      {previewPathData ? (
                        <svg 
                          height="80" 
                          className="flex-shrink-0"
                          viewBox={previewViewBox} 
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <path d={previewPathData} fill="#ffffff" />
                        </svg>
                      ) : (
                        <p className="text-neutral-600 text-sm">Type some text to preview glyphs</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4 text-white">
                      <Type className="w-5 h-5 text-blue-400" />
                      <h2 className="text-lg font-medium">{fontDetails.fullName}</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <span className="block text-neutral-500 mb-1">Family</span>
                        <span className="text-neutral-200">{fontDetails.familyName}</span>
                      </div>
                      <div>
                        <span className="block text-neutral-500 mb-1">Subfamily</span>
                        <span className="text-neutral-200">{fontDetails.subfamilyName}</span>
                      </div>
                      <div>
                        <span className="block text-neutral-500 mb-1">Version</span>
                        <span className="text-neutral-200">{fontDetails.version}</span>
                      </div>
                      <div>
                        <span className="block text-neutral-500 mb-1">Glyphs</span>
                        <span className="text-neutral-200">{fontDetails.numGlyphs}</span>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-neutral-800 text-sm">
                      <div className="mb-4">
                        <span className="block text-neutral-500 mb-1">Designer</span>
                        <span className="text-neutral-200 truncate block text-ellipsis">{fontDetails.designer}</span>
                      </div>
                      <div>
                        <span className="block text-neutral-500 mb-1">Copyright</span>
                        <span className="text-neutral-200 block text-ellipsis overflow-hidden break-words">{fontDetails.copyright}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={generatePackage}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
                  >
                    <Download className="w-5 h-5" />
                    Generate & Download Package
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'design' && (
            <div className="animate-in fade-in duration-300">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-medium">Design Parameters</h2>
                </div>
                <p className="text-neutral-400 text-sm mb-6">Adjust these settings to conceptually design a new font style.</p>
                
                <div className="space-y-8 bg-neutral-900/80 p-6 rounded-lg border border-neutral-700/50">
                  {/* Thickness Slider */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                      <label className="text-neutral-300">Thickness</label>
                      <span className="text-emerald-400">{thickness}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={thickness}
                      onChange={(e) => setThickness(Number(e.target.value))}
                      className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Thin / Hairline</span>
                      <span>Heavy / Black</span>
                    </div>
                  </div>

                  {/* Proportion Slider */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                      <label className="text-neutral-300">Capital to Lowercase Proportion</label>
                      <span className="text-emerald-400">{proportion}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={proportion}
                      onChange={(e) => setProportion(Number(e.target.value))}
                      className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Small Lowercase</span>
                      <span>Tall Lowercase</span>
                    </div>
                  </div>

                  {/* Shape Slider */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                      <label className="text-neutral-300">Letter Shape</label>
                      <span className="text-emerald-400">{shape}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={shape}
                      onChange={(e) => setShape(Number(e.target.value))}
                      className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Squared / Angular</span>
                      <span>Curved / Rounded</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verbiage / Prompt */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-medium">AI Instructions</h2>
                </div>
                <p className="text-neutral-400 text-sm mb-4">Provide any additional verbiage or style requests (e.g., "cyberpunk mood", "elegant serif like dripping ink").</p>
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe your ideal font flair..."
                  className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              {generateError && (
                <div className="bg-red-900/30 border border-red-800 text-red-200 p-4 rounded-lg flex items-start gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{generateError}</p>
                </div>
              )}

              <button 
                onClick={handleDesignGenerate}
                disabled={isGenerating}
                className={`w-full text-white flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-all shadow-lg ${isGenerating ? 'bg-emerald-600/50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-5 h-5 animate-spin" />
                    Generating Font Preview...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Font Preview
                  </>
                )}
              </button>

              {/* Preview Result */}
              {(generatedSvg || isGenerating) && (
                <div className="mt-8 pt-8 border-t border-neutral-700/50 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-lg font-medium mb-4 text-white">Visual Preview</h3>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-8 min-h-[200px] flex items-center justify-center relative overflow-hidden">
                    {isGenerating ? (
                      <div className="text-neutral-500 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        <p className="text-sm">The AI is crafting path data...</p>
                      </div>
                    ) : (generatedSvg && (
                      <div 
                        className="w-full text-center flex justify-center text-white"
                        dangerouslySetInnerHTML={{ __html: generatedSvg }}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
