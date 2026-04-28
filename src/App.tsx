/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { getRecipeRecommendations, Recipe, detectIngredients } from './services/geminiService';
import { detectIngredientsLocal, LocalIngredient, BoundingBox } from './services/localVisionService';
import { ChefHat, Refrigerator, ArrowRight, Clock, Info, CheckCircle2, ShoppingBasket, X, Cloud, Cpu, BookmarkPlus, Bookmark, BookHeart, Plus, Trash2, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [view, setView] = useState<'camera' | 'results' | 'saved'>('camera');
  const [analyzeStatus, setAnalyzeStatus] = useState<string>('');
  const [aiMode, setAiMode] = useState<'cloud' | 'local'>('cloud');
  const [newIngredient, setNewIngredient] = useState('');
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [imageSize, setImageSize] = useState<{width: number; height: number}>({width: 0, height: 0});

  useEffect(() => {
    const saved = localStorage.getItem('savedRecipes');
    if (saved) {
      try {
        setSavedRecipes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved recipes", e);
      }
    }
  }, []);

  const saveRecipeToLocal = (recipes: Recipe[]) => {
    localStorage.setItem('savedRecipes', JSON.stringify(recipes));
  };

  const toggleSaveRecipe = (recipe: Recipe) => {
    const isSaved = savedRecipes.some(r => r.title === recipe.title);
    let newSaved;
    if (isSaved) {
      newSaved = savedRecipes.filter(r => r.title !== recipe.title);
    } else {
      newSaved = [...savedRecipes, recipe];
    }
    setSavedRecipes(newSaved);
    saveRecipeToLocal(newSaved);
  };

  const isRecipeSaved = (recipe: Recipe | null) => {
    if (!recipe) return false;
    return savedRecipes.some(r => r.title === recipe.title);
  };

  const handleCapture = async (base64Image: string) => {
    setCapturedImage(`data:image/jpeg;base64,${base64Image}`);
    setIsAnalyzing(true);
    setAnalyzeStatus(aiMode === 'local' ? '加載本地偵測模型中...' : '雲端 AI 視覺掃描中...');
    try {
      if (aiMode === 'local') {
        const result = await detectIngredientsLocal(base64Image, (status) => {
          setAnalyzeStatus(status);
        });
        setIngredients(result.ingredients);
        setDetections(result.detections);
        setImageSize(result.imageSize);
      } else {
        const detected = await detectIngredients(base64Image);
        setIngredients(detected);
        setDetections([]);
        setImageSize({width: 0, height: 0});
      }
      setRecipes([]); // Reset recipes so user can edit ingredients first
      setView('results');
    } catch (error: any) {
      console.error("Workflow error:", error);
      alert('分析失敗: ' + (error.message || error));
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStatus('');
    }
  };

  const generateRecipesMenu = async () => {
    const ingredientNames = ingredients.map(i => i.name);
    if (ingredientNames.length === 0) return;
    
    setIsGeneratingRecipes(true);
    try {
      const recommendations = await getRecipeRecommendations(ingredientNames);
      setRecipes(recommendations);
    } catch (error: any) {
      alert('生成食譜失敗: ' + (error.message || error));
    } finally {
      setIsGeneratingRecipes(false);
    }
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredient.trim()) return;
    setIngredients([...ingredients, { name: newIngredient.trim(), count: 1 }]);
    setNewIngredient('');
  };

  const handleRemoveIngredient = (idx: number) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(idx, 1);
    setIngredients(newIngredients);
  };

  const handleReset = () => {
    setIngredients([]);
    setRecipes([]);
    setDetections([]);
    setCapturedImage(null);
    setSelectedRecipe(null);
    setView('camera');
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="pt-8 pb-6 px-6 max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('camera')}>
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <ChefHat className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 hidden sm:block">AI 智能冰箱廚師</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView(view === 'saved' ? (capturedImage ? 'results' : 'camera') : 'saved')}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-colors ${view === 'saved' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <BookHeart className="w-4 h-4" />
            <span className="hidden sm:inline">收藏的食譜</span>
            {savedRecipes.length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">{savedRecipes.length}</span>
            )}
          </button>
          {view === 'results' && (
            <button 
              onClick={handleReset}
              className="text-sm font-medium text-orange-600 hover:text-orange-700 underline underline-offset-4"
            >
              重新掃描
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6">
        <AnimatePresence mode="wait">
          {view === 'camera' && (
            <motion.section 
              key="camera-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2 mb-4">
                <h2 className="text-3xl font-bold text-gray-900">冰箱裡有什麼？</h2>
                <p className="text-gray-500">拍攝一張冰箱內部的照片，我們將為您推薦食譜</p>
              </div>

              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 p-1.5 flex rounded-full shadow-inner max-w-fit mx-auto border border-gray-200">
                  <button
                    onClick={() => setAiMode('local')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${aiMode === 'local' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Cpu className="w-4 h-4" /> 本地基礎偵測
                  </button>
                  <button
                    onClick={() => setAiMode('cloud')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${aiMode === 'cloud' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Cloud className="w-4 h-4" /> 雲端進階辨識
                  </button>
                </div>
              </div>

              <CameraCapture onCapture={handleCapture} isLoading={isAnalyzing} statusText={analyzeStatus} />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 mb-4">
                    <Refrigerator className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">精準辨識</h3>
                  <p className="text-sm text-gray-500">透過 AI 自動偵測蔬菜、水果與肉類</p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500 mb-4">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">食譜推薦</h3>
                  <p className="text-sm text-gray-500">根據現有食材推薦適合的美味料理</p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500 mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">簡單步驟</h3>
                  <p className="text-sm text-gray-500">提供詳盡的烹飪過程，零廚藝也能上手</p>
                </div>
              </div>
            </motion.section>
          )}

          {view === 'saved' && (
            <motion.section 
              key="saved-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-8">
                <BookHeart className="w-8 h-8 text-orange-500" />
                <h2 className="text-3xl font-bold text-gray-900">我的食譜收藏</h2>
              </div>
              
              {savedRecipes.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                    <Bookmark className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">還沒有收藏的食譜</h3>
                  <p className="text-gray-500">趕快拍張冰箱照片，尋找美味靈感吧！</p>
                  <button 
                    onClick={() => setView('camera')}
                    className="mt-6 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors"
                  >
                    去掃描冰箱
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedRecipes.map((recipe, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -5 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white group cursor-pointer rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col items-stretch h-full hover:shadow-xl hover:shadow-orange-500/10 transition-all"
                      onClick={() => setSelectedRecipe(recipe)}
                    >
                      <div className="p-6 flex flex-col flex-grow">
                        <div className="flex justify-between items-start gap-4 mb-3">
                          <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-orange-600 transition-colors">{recipe.title}</h3>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleSaveRecipe(recipe); }}
                            className="text-orange-500 p-1 bg-orange-50 rounded-full hover:bg-orange-100 transition-colors"
                          >
                            <Bookmark className="w-5 h-5 fill-current" />
                          </button>
                        </div>
                        <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-grow">{recipe.description}</p>
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 text-orange-500 font-medium text-sm">
                          查看詳情 <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {view === 'results' && (
            <motion.section 
              key="results-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              {/* Image with Detections */}
              {capturedImage && (
                <div className="bg-white p-3 md:p-4 rounded-3xl shadow-sm border border-gray-100">
                  <div className="relative w-full overflow-hidden rounded-2xl bg-black/5 flex items-center justify-center">
                    <div className="relative inline-block max-w-full">
                      <img src={capturedImage} alt="Analyzed Fridge" className="max-h-[300px] md:max-h-[400px] w-auto block object-contain rounded-xl" />
                      {detections.map((box, idx) => {
                        const top = (box.y / imageSize.height) * 100;
                        const left = (box.x / imageSize.width) * 100;
                        const width = (box.width / imageSize.width) * 100;
                        const height = (box.height / imageSize.height) * 100;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 + idx * 0.1 }}
                            style={{
                              position: 'absolute',
                              top: `${top}%`,
                              left: `${left}%`,
                              width: `${width}%`,
                              height: `${height}%`,
                            }}
                            className="border-2 lg:border-3 border-emerald-500 bg-emerald-500/10 rounded pointer-events-none flex flex-col"
                          >
                            <div className="bg-emerald-500 text-white text-[10px] md:text-sm font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-br truncate max-w-full inline-flex items-center gap-1 shadow-sm self-start">
                              <span>{box.class}</span>
                              <span className="opacity-80 font-mono text-[9px] md:text-xs">{Math.round(box.score * 100)}%</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <ShoppingBasket className="w-6 h-6 text-orange-500" />
                    <h2 className="text-2xl font-bold text-gray-900">確認您的食材</h2>
                  </div>
                  {recipes.length === 0 && ingredients.length > 0 && (
                    <button 
                      onClick={generateRecipesMenu}
                      disabled={isGeneratingRecipes}
                      className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingRecipes ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                          正在思考食譜
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          根據以上食材推薦食譜
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-3 mb-6">
                  {ingredients.map((item, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      key={idx} 
                      className="px-4 py-2 bg-gray-50 rounded-full text-gray-700 font-medium border border-gray-200 flex items-center gap-2 group pr-2"
                    >
                      <span>{item.name}</span>
                      {item.count && item.count > 1 && (
                        <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-md">
                          x{item.count}
                        </span>
                      )}
                      <button 
                        onClick={() => handleRemoveIngredient(idx)}
                        className="ml-1 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 md:opacity-100"
                        title="移除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                  
                  {ingredients.length === 0 && (
                    <p className="text-gray-400 italic">尚未添加任何食材</p>
                  )}
                </div>
                
                <form onSubmit={handleAddIngredient} className="flex gap-2 max-w-sm">
                  <input 
                    type="text" 
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    placeholder="手動新增漏掉的食材..."
                    className="flex-grow px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm"
                  />
                  <button 
                    type="submit" 
                    disabled={!newIngredient.trim()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              {/* Recipe Recommendations */}
              {recipes.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">為您推薦的食譜</h2>
                    <span className="text-sm text-gray-500 px-3 py-1 bg-gray-100 rounded-full">發現 {recipes.length} 道料理</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recipes.map((recipe, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -5 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + idx * 0.1 }}
                        className="bg-white group cursor-pointer rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col h-full hover:shadow-xl hover:shadow-orange-500/10 transition-all"
                        onClick={() => setSelectedRecipe(recipe)}
                      >
                        <div className="h-3 bg-orange-400 opacity-20 group-hover:opacity-100 transition-opacity" />
                        <div className="p-6 flex flex-col flex-grow">
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-orange-600 transition-colors">{recipe.title}</h3>
                          </div>
                          <p className="text-gray-500 text-sm line-clamp-3 mb-4 flex-grow">{recipe.description}</p>
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                              <Clock className="w-3.5 h-3.5" />
                              {recipe.cookingTime}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all">
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Recipe Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecipe(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="relative p-8 pb-0">
                <button 
                  onClick={() => setSelectedRecipe(null)}
                  className="absolute top-6 right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                <div className="flex items-center gap-2 text-orange-500 font-bold text-sm uppercase tracking-wider mb-2">
                  <Clock className="w-4 h-4" />
                  {selectedRecipe.cookingTime}
                </div>
                <div className="flex items-start justify-between gap-4 mb-4 pr-12">
                  <h2 className="text-3xl font-black text-gray-900 leading-tight">{selectedRecipe.title}</h2>
                  <button 
                    onClick={() => toggleSaveRecipe(selectedRecipe)}
                    className="flex-shrink-0 p-3 bg-orange-50 hover:bg-orange-100 text-orange-500 rounded-full transition-colors group"
                    title={isRecipeSaved(selectedRecipe) ? "取消收藏" : "收藏食譜"}
                  >
                    {isRecipeSaved(selectedRecipe) ? (
                      <Bookmark className="w-6 h-6 fill-current animate-in spin-in-12" />
                    ) : (
                      <BookmarkPlus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                  <Info className="w-5 h-5 text-orange-400 shrink-0" />
                  {selectedRecipe.description}
                </div>
              </div>

              <div className="flex-grow overflow-y-auto p-8 pt-0 space-y-10 custom-scrollbar">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ShoppingBasket className="w-5 h-5 text-orange-500" />
                    所需食材
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl text-gray-700 text-sm border border-gray-200/50">
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0 mt-1.5" />
                        <span className="leading-relaxed">{ing}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-orange-500" />
                    烹飪步驟
                  </h3>
                  <div className="space-y-4">
                    {selectedRecipe.instructions.map((step, i) => (
                      <div key={i} className="flex gap-4 p-5 bg-white border border-gray-100 hover:border-orange-100 rounded-2xl shadow-sm transition-colors group">
                        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-sm group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          {i + 1}
                        </span>
                        <p className="text-gray-700 leading-relaxed pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-center gap-4">
                <button 
                  onClick={() => setSelectedRecipe(null)}
                  className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors shadow-lg shadow-gray-900/20"
                >
                  關閉詳情
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


