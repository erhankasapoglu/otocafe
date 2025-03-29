// SliderDatePicker.jsx
"use client";
import React, { useState, useEffect } from "react";
import MobilePicker from "react-mobile-picker";
import dayjs from "dayjs";

function generateDateOptions(startYear = 2000, endYear = 2030) {
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(String(y));
  }
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
  return { years, months, days };
}

export default function SliderDatePicker({ label, value, onChange }) {
  // value: "YYYY-MM-DD" string; eğer boş ise bugünü al
  const initialDate = value ? dayjs(value, "YYYY-MM-DD") : dayjs();
  const [pickerValue, setPickerValue] = useState({
    year: String(initialDate.year()),
    month: String(initialDate.month() + 1).padStart(2, "0"),
    day: String(initialDate.date()).padStart(2, "0"),
  });

  // Oluşturulan opsiyonlar
  const { years, months, days } = generateDateOptions(2000, 2030);
  const optionGroups = {
    year: years,
    month: months,
    day: days,
  };

  // Formatlama: "YYYY-MM-DD"
  function formatYMD(val) {
    return `${val.year}-${val.month}-${val.day}`;
  }

  useEffect(() => {
    onChange(formatYMD(pickerValue));
  }, [pickerValue]);

  return (
    <div className="mb-4">
      <div className="font-bold mb-1">{label}</div>
      <MobilePicker
        optionGroups={optionGroups}
        value={pickerValue}
        onChange={setPickerValue}
      />
    </div>
  );
}
