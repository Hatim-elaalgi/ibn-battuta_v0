# Project Ramadan - Task Planning & Implementation Roadmap

**Project**: AI-Powered Landmark Recognition with Location Context  
**Status**: Vision feature operational, accuracy enhancement phase  
**Date**: March 1, 2026

---

## 📊 Current State Summary

### ✅ Completed
- Qwen 3 VL 4B vision model integrated and working
- Official LM Studio API implementation (structured input arrays)
- Image upload with compression (JPEG/PNG/WebP support)
- Global landmark recognition enabled in system prompt
- Tangier landmark recognition: meduim Accurate ✓
- Moroccan/Egyptian landmark recognition: Working ✓
- Backend API fully functional on port 8000

### ⚠️ Known Issues
- European landmarks (Eiffel Tower) misidentified with other major monuments
- Model lacks visual descriptors for non-Islamic architecture
- No location context provided to model during inference
- Limited precision on landmarks outside Moroccan region

### 🎯 Next Phase: Location-Based Landmark Recognition
The key insight: **Real-time user location will dramatically improve accuracy**

---

## 🚀 Priority Tasks

### PHASE 1: Location Integration (IMMEDIATE - High Impact)
**Goal**: Capture user's real-time location when uploading images

#### Task 1.1: Frontend - Enable Geolocation API
- **File**: `frontend/src/components/chat/ChatContainer.jsx`
- **What**: Add Geolocation API to capture latitude/longitude when user uploads image
- **Why**: Provides context to LLM about where image was taken
- **Details**:
  - Request user permission for location
  - Capture coords on image upload
  - Fallback to "Unknown location" if denied
  - Send location data with image to backend
- **Acceptance Criteria**:
  - Location button appears in UI ✓
  - Browser requests permission ✓
  - Coords captured and logged ✓
  - Sent with API request ✓

#### Task 1.2: Backend - Accept Location Data
- **File**: `backend/app/api/api_v1/endpoints/chat.py`
- **What**: Modify `/chat` endpoint to accept `latitude` and `longitude` parameters
- **Why**: Pass location context to vision model
- **Details**:
  - Add optional latitude/longitude fields to request
  - Store in message context
  - Pass to LLM as additional system context
- **Acceptance Criteria**:
  - New fields accepted ✓
  - No errors when location provided ✓
  - Works with or without location ✓

#### Task 1.3: Update Vision System Prompt
- **File**: `backend/app/core/prompts/persona.py`
- **What**: Enhance VISION_SYSTEM_PROMPT to use location context
- **Why**: Model can prioritize nearby landmarks
- **Details**:
  - Add location preprocessing (reverse geocoding if needed)
  - Provide model with: "Image taken in [CITY/REGION], identify landmark"
  - Adjust response based on location likelihood
  - Example: If in Tangier, prioritize Tangier landmarks but still recognize other locations
- **Acceptance Criteria**:
  - System prompt updated ✓
  - Location context integrated ✓
  - Model uses location in reasoning ✓

---

### PHASE 2: Knowledge Base Enhancement (High Priority)
**Goal**: Improve landmark recognition accuracy with richer contextual data

#### Task 2.1: Expand Tangier Knowledge Base
- **File**: `backend/app/data/tangier_data.txt` + ChromaDB
- **What**: Add detailed visual descriptors for Tangier landmarks
- **Details**:
  - **Kasbah**: White-washed walls, blue doors, octagonal towers, terracotta roofs, overlooks medina
  - **Café El Hafa**: Clifftop location, blue/white striped umbrellas, sea view, traditional cushion seating
  - **Hassan Tower**: Green-tiled minaret, distinctive green tile work, white stone base
  - **Old Medina**: Narrow winding streets, traditional architecture, souks, whitewashed buildings
  - **Malabata Beach**: Sandy beach, fortress ruins, coastal setting, local swimming spot
- **Add comparisons**: "Unlike Marrakech's Koutoubia (carved details), Hassan Tower is..."
- **Acceptance Criteria**:
  - 20+ descriptive chunks created ✓
  - Added to ChromaDB ✓
  - Model retrieves relevant context ✓

#### Task 2.2: Add Global Landmark Database
- **What**: Create knowledge base for frequently-uploaded landmarks beyond Tangier
- **Landmarks to add**:
  - **Marrakech**: Koutoubia Mosque (minaret, carved stone, square location)
  - **Cairo**: Pyramids/Sphinx (limestone, monumental scale, desert setting)
  - **Paris**: Eiffel Tower (iron lattice, distinctive shape, monument location)
  - **Rome**: Colosseum (multiple arches, Roman architecture, amphitheater)
  - **Barcelona**: Sagrada Familia (Gothic design, spires, basilica)
- **Details**: Visual cues, architectural style, location context, distinguishing features
- **Acceptance Criteria**:
  - Knowledge base created ✓
  - Integrated with RAG system ✓
  - Model retrieves for non-Tangier images ✓

#### Task 2.3: Location-Based RAG Routing
- **File**: `backend/app/core/rag.py`
- **What**: Query appropriate knowledge base segment based on user location
- **Why**: Faster retrieval, higher relevance
- **Details**:
  - If location in Tangier region → Query Tangier DB first
  - If location in Morocco → Query Moroccan monuments
  - If location elsewhere → Query global DB
- **Acceptance Criteria**:
  - Location-based routing implemented ✓
  - Correct database queried ✓
  - Performance improved ✓

---

### PHASE 3: Testing & Validation (Medium Priority)
**Goal**: Verify accuracy improvements from location + knowledge base

#### Task 3.1: Create Location-Based Test Suite
- **What**: Test landmarks with AND without location data
- **Details**:
  - Test 1: Eiffel Tower + location "Paris" → Should identify correctly
  - Test 2: Eiffel Tower + location "Tangier" → Should identify correctly (not affected)
  - Test 3: Kasbah + location "Tangier" → Enhanced description expected
  - Test 4: Sphinx + location "Cairo" → Precise Egyptian context
  - Test 5: Koutoubia + location "Marrakech" → Marrakech-specific response
- **Acceptance Criteria**:
  - All tests pass ✓
  - Accuracy improvements measured ✓
  - No regression on Tangier ✓

#### Task 3.2: Benchmark Accuracy Before/After
- **What**: Compare model responses with and without location context
- **Metrics**:
  - Correct landmark identification rate
  - False Tangier claims rate
  - Response specificity/relevance score
- **Acceptance Criteria**:
  - Baseline metrics recorded ✓
  - Post-enhancement metrics show improvement ✓
  - Improvement >20% ✓

---

### PHASE 4: User Experience Improvements (Lower Priority)
**Goal**: Make location feature friendly and transparent

#### Task 4.1: Location UI Polish
- **File**: `frontend/src/components/chat/ChatContainer.jsx`
- **What**: Improve location UX
- **Details**:
  - Show current location (city/region) in upload UI
  - Allow manual location override
  - Show location in chat message context
  - "📍 Tangier" badge next to uploaded image
- **Acceptance Criteria**:
  - Location display visible ✓
  - Manual override works ✓
  - Messages show location context ✓

#### Task 4.2: Documentation Update
- **File**: `README.md` or new `FEATURES.md`
- **What**: Document location-based landmark feature
- **Details**:
  - How geolocation works
  - Privacy considerations
  - Why location improves accuracy
  - How to enable/disable
- **Acceptance Criteria**:
  - Documentation complete ✓
  - User-friendly ✓

---

## 📋 Implementation Sequence

```
WEEK 1:
  Day 1-2: Task 1.1 (Geolocation frontend) + Task 1.2 (Backend endpoint)
  Day 3-4: Task 1.3 (Prompt update) + Task 3.1 (Test creation)
  Day 5:   Task 2.1 (Tangier KB expansion)

WEEK 2:
  Day 1-2: Task 2.2 (Global landmark DB)
  Day 3-4: Task 2.3 (RAG routing)
  Day 5:   Task 3.2 (Benchmark testing)

WEEK 3:
  Day 1-2: Task 4.1 (UI polish)
  Day 3:   Task 4.2 (Documentation)
  Day 4-5: Final testing & deployment
```

---

## 🎯 Expected Outcomes

### After Phase 1 (Location Integration)
- User location captured with every image
- Backend receives and processes location data
- System prompt uses location as context hint
- **Expected improvement**: 15-20% accuracy boost

### After Phase 2 (Knowledge Base)
- Richer landmark descriptions available
- Location-aware knowledge retrieval
- Global landmark coverage
- **Expected improvement**: Additional 20-30% accuracy boost

### After Phase 3 & 4 (Testing + UX)
- Validated improvements with metrics
- User-friendly interface with location display
- Production-ready system
- **Final accuracy target**: 85-90% on common landmarks

---

## 📌 Key Metrics to Track

| Metric | Baseline | Target |
|--------|----------|--------|
| Tangier landmark accuracy | 80% | 90% |
| False Tangier claims | 2% | 0.5% |
| European landmark accuracy | 40% | 75% |
| Response relevance (user rated) | N/A | 4.2/5.0 |
| Average response time | 2.5s | <3s |

---

## ⚠️ Important Notes

### Why Location Matters for This Project
1. **Context provision**: Model knows search space (Tangier vs Paris vs Cairo)
2. **Accuracy boost**: Nearby landmarks prioritized by model reasoning
3. **False claim prevention**: Less likely to claim unfamiliar location is Tangier
4. **User experience**: Responses tailored to user's actual location
5. **Arabic/Islamic architecture priority**: Location helps model focus on relevant styles

### Privacy Considerations
- Location requested with browser permission
- User can deny (graceful fallback to "Unknown location")
- Location only sent during image upload
- Not stored permanently in sessions
- Shown transparently in mobile UI

### Technical Dependencies
- Browser Geolocation API (available in modern browsers)
- FastAPI location parameter handling (simple addition)
- ChromaDB location-based filtering (optional optimization)
- LM Studio API unchanged (still using official endpoint)

---

## 🚦 Success Criteria - Full Project Completion

- [ ] Geolocation API integrated and working on frontend
- [ ] Backend accepts and processes location data
- [ ] System prompt enhanced with location context
- [ ] Tangier knowledge base expanded (20+ descriptors)
- [ ] Global landmark database created (50+ landmarks)
- [ ] Location-aware RAG routing implemented
- [ ] Test suite created and all tests pass
- [ ] Accuracy benchmarks show 25%+ improvement
- [ ] UI displays location information
- [ ] Documentation complete and clear
- [ ] Zero regressions on existing functionality
- [ ] Ready for production deployment

---

**Last Updated**: March 1, 2026  
**Next Review**: After Phase 1 completion  
**Owner**: AI Vision Enhancement Team  
