import { useState, useEffect, useRef } from 'react';
import API_URL, { apiCall } from '../config/api';
import { useSettings } from '../context/SettingsContext';

const RoomRow = ({ room, index, roomCategories, onUpdate, onRemove, mealTypes = [], readOnly = false, checkInDate = new Date().toISOString().split('T')[0], nights = 1 }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const prevCategoryId = useRef(room.categoryId);

    const handleChange = (field, value) => {
        onUpdate(index, { ...room, [field]: value });
    };

    // Auto-fetch dynamic price when category changes
    useEffect(() => {
        const fetchPrice = async () => {
            const categoryWasEmpty = !prevCategoryId.current;
            const categoryIsNowSet = !!room.categoryId;
            const categoryChanged = room.categoryId !== prevCategoryId.current;

            // Only fetch if category changed. 
            // If it's the first time setting a category (categoryWasEmpty is true), 
            // only fetch if we don't already have a valid base price.
            // If the user IS switching from one category to another, always fetch the new price.
            const shouldFetch = categoryIsNowSet && categoryChanged && (
                !categoryWasEmpty || (categoryWasEmpty && (!room.baseRate || room.baseRate === 0))
            );

            if (shouldFetch) {
                try {
                    const res = await apiCall(`/api/pricing/calculate/${room.categoryId}?date=${checkInDate}`);
                    const data = await res.json();
                    if (data.success && data.price !== undefined) {
                        const basePrice = data.price;
                        // Calculate total with current meal plan
                        const currentMeal = mealTypes.find(m => m.shortCode === room.mealPlan);
                        const mealPrice = currentMeal ? (currentMeal.price || 0) : 0;

                        onUpdate(index, {
                            ...room,
                            baseRate: basePrice,
                            ratePerNight: basePrice + mealPrice
                        });
                    }
                } catch (err) {
                    console.error('Dynamic pricing fetch error:', err);
                }
            }
            prevCategoryId.current = room.categoryId;
        };
        fetchPrice();
    }, [room.categoryId, checkInDate, mealTypes]);

    const category = roomCategories[room.categoryId];
    const baseRate = category?.baseRate || 0;



    const [availableRooms, setAvailableRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);

    // Fetch available rooms for this row
    useEffect(() => {
        const fetchAvailableRooms = async () => {
            if (!room.categoryId || !checkInDate || !nights) {
                setAvailableRooms([]);
                return;
            }

            try {
                setLoadingRooms(true);
                // Calculate check-out date
                const ciDate = new Date(checkInDate);
                const coDate = new Date(ciDate);
                coDate.setDate(coDate.getDate() + nights);
                const checkOutDate = coDate.toISOString().split('T')[0];

                const response = await apiCall(`/api/rooms/available?type=${room.categoryId}&from=${checkInDate}&to=${checkOutDate}`);
                const data = await response.json();

                if (data.success && data.data) {
                    setAvailableRooms(data.data);
                }
            } catch (error) {
                console.error('Error fetching available rooms:', error);
            } finally {
                setLoadingRooms(false);
            }
        };

        fetchAvailableRooms();
    }, [room.categoryId, checkInDate, nights]);

    const handleRoomNumberChange = (value) => {
        const selectedRoom = availableRooms.find(r => r.roomNumber === value);
        if (selectedRoom) {
            const newBaseRate = selectedRoom.price || room.baseRate || 0;
            const currentMeal = mealTypes.find(m => m.shortCode === room.mealPlan);
            const mealPrice = currentMeal ? (currentMeal.price || 0) : 0;

            onUpdate(index, {
                ...room,
                roomNumber: value,
                baseRate: newBaseRate,
                ratePerNight: newBaseRate + mealPrice
            });
        } else {
            handleChange('roomNumber', value);
        }
    };

    return (
        <div className="room-row">
            <div className="room-header">
                <h4>Room {index + 1}</h4>
                {index > 0 && (
                    <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onRemove(index)}
                    >
                        ✕ Remove
                    </button>
                )}
            </div>

            <div className="room-fields">
                <div className="form-row">
                    <label>Room Category</label>
                    <select
                        value={room.categoryId}
                        onChange={(e) => handleChange('categoryId', e.target.value)}
                        disabled={readOnly}
                    >
                        <option value="">Select Room Category</option>
                        {Object.entries(roomCategories).map(([id, cat]) => (
                            <option key={id} value={id}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-row">
                    <label>Room Number</label>
                    <select
                        value={room.roomNumber || ''}
                        onChange={(e) => handleRoomNumberChange(e.target.value)}
                        disabled={readOnly || !room.categoryId || loadingRooms}
                        className={loadingRooms ? 'loading-select' : ''}
                    >
                        <option value="">
                            {loadingRooms ? 'Loading available rooms...' : !room.categoryId ? '-- Select Category First --' : '-- Select Room No. --'}
                        </option>
                        {/* Include current room if it exists (for editing) */}
                        {room.roomNumber && !availableRooms.find(r => r.roomNumber === room.roomNumber) && (
                            <option key="current" value={room.roomNumber}>{room.roomNumber} (Current)</option>
                        )}
                        {availableRooms.map((r) => (
                            <option key={r._id} value={r.roomNumber}>
                                {r.roomNumber}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-row">
                    <label>Meal Plan</label>
                    <select
                        value={room.mealPlan}
                        onChange={(e) => {
                            const newPlan = e.target.value;

                            // Find prices
                            const oldMeal = mealTypes.find(m => m.shortCode === room.mealPlan);
                            const newMeal = mealTypes.find(m => m.shortCode === newPlan);

                            const oldMealPrice = oldMeal ? (oldMeal.price || 0) : 0;
                            const newMealPrice = newMeal ? (newMeal.price || 0) : 0;

                            // Calculate Base Rate (use stored or derive)
                            let currentBase = room.baseRate;
                            if (currentBase === undefined) {
                                currentBase = (room.ratePerNight || 0) - oldMealPrice;
                                if (currentBase < 0) currentBase = 0;
                            }

                            onUpdate(index, {
                                ...room,
                                mealPlan: newPlan,
                                baseRate: currentBase,
                                ratePerNight: currentBase + newMealPrice
                            });
                        }}
                    >
                        <option value="">Select Plan</option>
                        {mealTypes && mealTypes.length > 0 ? (
                            mealTypes.map(mt => (
                                <option key={mt._id} value={mt.shortCode}>
                                    {mt.shortCode} ({mt.name}) - {cs}{mt.price}
                                </option>
                            ))
                        ) : (
                            // Fallback
                            <>
                                <option value="CP">CP (Room Only)</option>
                                <option value="MAP">MAP (B + D)</option>
                                <option value="AP">AP (All Meals)</option>
                            </>
                        )}
                    </select>
                </div>

                <div className="form-row">
                    <label>Adults</label>
                    <input
                        type="number"
                        min="1"
                        value={room.adultsCount}
                        onChange={(e) => handleChange('adultsCount', e.target.value)}
                        placeholder="Number of Adult"
                    />
                </div>

                <div className="form-row">
                    <label>Children</label>
                    <input
                        type="number"
                        min="0"
                        value={room.childrenCount}
                        onChange={(e) => handleChange('childrenCount', e.target.value)}
                        placeholder="Number of Childern"
                    />
                </div>

                <div className="form-row">
                    <label>Rate/Night</label>
                    <input
                        type="number"
                        min="0"
                        value={room.ratePerNight}
                        onChange={(e) => {
                            const newRate = e.target.value;
                            // Update baseRate based on current meal plan
                            const currentMeal = mealTypes.find(m => m.shortCode === room.mealPlan);
                            const mealPrice = currentMeal ? (currentMeal.price || 0) : 0;
                            const numericRate = parseFloat(newRate) || 0;

                            onUpdate(index, {
                                ...room,
                                ratePerNight: newRate,
                                baseRate: numericRate - mealPrice
                            });
                        }}
                        disabled={readOnly}
                        placeholder="0.00"
                    />
                </div>

                <div className="form-row">
                    <label>Discount</label>
                    <input
                        type="number"
                        min="0"
                        value={room.discount}
                        onChange={(e) => handleChange('discount', e.target.value)}
                        placeholder="0.00"
                    />
                </div>

                <div className="form-row">
                    <label>Total</label>
                    <input
                        type="text"
                        disabled
                        value={`${cs}${(((parseFloat(room.ratePerNight) || 0) - (parseFloat(room.discount) || 0)) * nights).toFixed(2)}`}
                        className="total-field"
                    />
                </div>

                <div className="form-row">
                    <label>Notes</label>
                    <input
                        type="text"
                        placeholder="Special requests..."
                        value={room.notes || ''}
                        onChange={(e) => handleChange('notes', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

export default RoomRow;
