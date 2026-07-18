from datetime import date

def calculate_carbon(material: str) -> str:
    """根據材質初估碳排放量"""
    m = (material or "").strip().lower()
    if any(keyword in m for keyword in ["木", "wood"]):
        return "1.5 kg CO2e"
    elif any(keyword in m for keyword in ["塑", "plas"]):
        return "6.2 kg CO2e"
    elif any(keyword in m for keyword in ["鐵", "金", "鋼", "metal", "steel"]):
        return "12.8 kg CO2e"
    return "3.0 kg CO2e"

def get_circular_advice(material: str, purchase_date: date, estimated_expiry: date) -> dict:
    """根據材質與壽命生成綠色循環處置建議"""
    m = (material or "").strip().lower()
    carbon = calculate_carbon(material)
    
    # 二手估價 (Demo 模擬，依剩餘壽命百分比計算 $100~$800 間)
    now = date.today()
    total_days = (estimated_expiry - purchase_date).days
    remaining_days = (estimated_expiry - now).days
    
    if total_days <= 0:
        pct = 0.0
    else:
        pct = max(0.0, min(1.0, remaining_days / total_days))
        
    min_price = int(100 + pct * 400)
    max_price = int(200 + pct * 600)
    
    # 回收與捐贈分類建議
    if any(keyword in m for keyword in ["木", "wood"]):
        recycle = "一般木質家具廢棄物回收，可拆解作為生質燃料或木屑再利用。"
        donate = "推薦捐贈至心路基金會物資站、二手家具合作社進行維修活化。"
    elif any(keyword in m for keyword in ["塑", "plas"]):
        recycle = "塑膠類家具回收，請交付清潔隊大宗資源回收車，將打碎熔融造粒再製。"
        donate = "推薦捐贈至育成社會福利基金會、或在鄰里跳蚤市場進行二手流通。"
    elif any(keyword in m for keyword in ["鐵", "金", "鋼", "metal", "steel"]):
        recycle = "金屬類資源回收，可進入熔爐熔融再製，回收價值極高。"
        donate = "推薦交付在地資源回收站、或提供給專業維修工坊作備用零件。"
    else:
        recycle = "大宗廢棄物，請提前致電清潔隊登記免費清運。"
        donate = "推薦丟入各區跳蚤市場二手捐贈箱、或在鄰里互助看板發布免費贈送。"

    return {
        "carbon_emissions": carbon,
        "resale_estimate": f"${min_price} - ${max_price}",
        "donation_channel": donate,
        "recycling_category": recycle
    }

def update_item_health(db_item) -> str:
    """登記維修保養紀錄後，自動更新健康狀態為良好"""
    if db_item.health_status in ["Needs Repair", "Fair"]:
        db_item.health_status = "Good"
    return db_item.health_status
