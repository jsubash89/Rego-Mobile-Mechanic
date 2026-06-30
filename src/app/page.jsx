"use client";
import React from "react";

function MainComponent() {
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const services = [
    { id: 1, name: "Oil Change", icon: "oil-can", price: "49.99" },
    { id: 2, name: "Inspection", icon: "clipboard-check", price: "79.99" },
    { id: 3, name: "Tune-Up", icon: "wrench", price: "129.99" },
    { id: 4, name: "Error Check", icon: "laptop-code", price: "59.99" },
  ];
  const [activeTab, setActiveTab] = useState("services");
  const [vehicles, setVehicles] = useState([]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [showOilOptions, setShowOilOptions] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAutoShops, setShowAutoShops] = useState(false);
  const [showDealerships, setShowDealerships] = useState(false);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedOil, setSelectedOil] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showMechanicOptions, setShowMechanicOptions] = useState(false);
  const [showMechanicList, setShowMechanicList] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [filterDistance, setFilterDistance] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [filterAvailability, setFilterAvailability] = useState("");

  const mechanics = [
    {
      id: 1,
      name: "John Smith",
      bio: "15+ years experience specializing in domestic vehicles",
      distance: 3.2,
      rating: 4.8,
      reviews: 156,
      availableTimes: ["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM"],
      certifications: ["ASE Master Technician", "BMW Certified"],
    },
    {
      id: 2,
      name: "Maria Rodriguez",
      bio: "10 years experience with European luxury vehicles",
      distance: 5.7,
      rating: 4.9,
      reviews: 98,
      availableTimes: ["10:00 AM", "1:00 PM", "3:30 PM"],
      certifications: ["Mercedes-Benz Certified", "Audi Certified"],
    },
    {
      id: 3,
      name: "David Chen",
      bio: "Specialist in hybrid and electric vehicles",
      distance: 4.1,
      rating: 4.7,
      reviews: 122,
      availableTimes: ["8:30 AM", "12:00 PM", "2:30 PM", "5:00 PM"],
      certifications: ["Tesla Certified", "Toyota Hybrid Certified"],
    },
  ];
  const [vehicleForm, setVehicleForm] = useState({
    make: "",
    model: "",
    year: "",
    vin: "",
    mileage: "",
  });
  const oilTypes = [
    {
      id: 2,
      name: "5W-30 Synthetic",
      price: 49.99,
      amazonLink: "#",
      autoZoneLink: "#",
      convenienceUpcharge: 15,
    },
    {
      id: 3,
      name: "5W-40 Synthetic",
      price: 54.99,
      amazonLink: "#",
      autoZoneLink: "#",
      convenienceUpcharge: 15,
    },
    {
      id: 4,
      name: "0W-20 Synthetic",
      price: 59.99,
      amazonLink: "#",
      autoZoneLink: "#",
      convenienceUpcharge: 15,
    },
    {
      id: 0,
      name: "I'm not sure. Go with mechanic recommendation",
      price: "TBD",
    },
    {
      id: 1,
      name: "I will provide my own oil",
      price: "0",
    },
  ];
  const handleVehicleSubmit = (e) => {
    e.preventDefault();
    setVehicles([...vehicles, { ...vehicleForm, id: Date.now() }]);
    setVehicleForm({ make: "", model: "", year: "", vin: "", mileage: "" });
    setShowVehicleForm(false);
  };
  const handleAutoShopSelection = () => {
    if (vehicles.length === 0) {
      setShowVehicleForm(true);
      setShowServiceModal(false);
    } else if (vehicles.length === 1) {
      setSelectedVehicle(vehicles[0]);
      setShowOilOptions(true);
      setShowServiceModal(false);
    } else {
      setShowVehicleSelector(true);
      setShowServiceModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-[#1E3A8A] shadow-lg p-6">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-[24px] font-roboto font-bold text-white">
            Mobile Mechanic
          </h1>
          <div className="flex gap-6">
            <button className="px-6 py-3 rounded-lg text-white hover:text-[#FFD700] transition-colors font-roboto text-[16px]">
              <i className="fas fa-user mr-2"></i>Login
            </button>
            <button className="px-6 py-3 bg-[#FFD700] text-[#1E3A8A] rounded-lg hover:bg-[#F4C430] transition-colors font-roboto font-medium text-[16px]">
              <i className="fas fa-calendar-plus mr-2"></i>Book Now
            </button>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-12">
        <div className="mb-12 flex gap-6 border-b border-border">
          <button
            onClick={() => setActiveTab("services")}
            className={`pb-3 px-6 font-roboto text-[16px] ${
              activeTab === "services"
                ? "border-b-2 border-[#FFD700] text-[#1E3A8A]"
                : "text-[#6B7280] hover:text-[#1E3A8A]"
            } transition-colors`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveTab("vehicles")}
            className={`pb-3 px-6 font-roboto text-[16px] ${
              activeTab === "vehicles"
                ? "border-b-2 border-[#FFD700] text-[#1E3A8A]"
                : "text-[#6B7280] hover:text-[#1E3A8A]"
            } transition-colors`}
          >
            My Vehicles
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-6 font-roboto text-[16px] ${
              activeTab === "history"
                ? "border-b-2 border-[#FFD700] text-[#1E3A8A]"
                : "text-[#6B7280] hover:text-[#1E3A8A]"
            } transition-colors`}
          >
            Service History
          </button>
        </div>

        {activeTab === "services" && (
          <>
            <section className="text-center mb-16">
              <h1 className="text-[24px] font-roboto font-bold mb-6 text-[#1E3A8A]">
                Expert Auto Service at Your Location
              </h1>
              <p className="text-[16px] text-[#4B5563] font-roboto">
                Professional mechanics bring the repair shop to you
              </p>
            </section>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => {
                    setSelectedService(service);
                    if (vehicles.length > 1) {
                      setShowVehicleSelector(true);
                    } else if (vehicles.length === 1) {
                      setSelectedVehicle(vehicles[0]);
                      setShowServiceModal(true);
                    } else {
                      setShowVehicleForm(true);
                    }
                  }}
                  className="bg-card p-8 rounded-xl shadow-sm hover:shadow-xl transition-shadow cursor-pointer border border-border hover:border-primary"
                >
                  <div className="text-center">
                    <i
                      className={`fas ${service.icon} text-5xl text-[#1E3A8A] mb-6`}
                    ></i>
                    <h2 className="text-[20px] font-roboto font-medium mb-4 text-[#1E3A8A]">
                      {service.name}
                    </h2>
                    <p className="text-[#FFD700] font-roboto font-medium text-[16px]">
                      ${service.price}
                    </p>
                  </div>
                </div>
              ))}
            </section>
            <section className="mt-16 bg-white rounded-lg p-8 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="mb-6 md:mb-0">
                  <h2 className="text-[20px] font-roboto font-medium mb-2 text-[#212121]">
                    Ready to Get Started?
                  </h2>
                  <p className="text-[14px] font-roboto text-[#757575]">
                    Book your service now and get back on the road
                  </p>
                </div>
                <button className="bg-[#1E3A8A] px-8 py-3 rounded-lg hover:bg-[#1B2F66] text-white font-roboto font-medium text-[16px]">
                  Schedule Service
                </button>
              </div>
            </section>
          </>
        )}

        {activeTab === "vehicles" && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-[24px] font-bold font-roboto text-[#212121]">
                My Vehicles
              </h2>
              <button
                onClick={() => setShowVehicleForm(true)}
                className="bg-[#1E3A8A] px-4 py-2 rounded text-white font-roboto"
              >
                Add Vehicle
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="bg-white p-6 rounded-lg shadow-sm"
                >
                  <h3 className="text-[20px] font-roboto font-medium text-[#212121]">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                  <div className="mt-4 space-y-2 text-[#757575] font-roboto">
                    <p>VIN: {vehicle.vin}</p>
                    <p>Mileage: {vehicle.mileage}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-8">
            <h2 className="text-[24px] font-bold font-roboto text-[#212121]">
              Service History
            </h2>
            {serviceHistory.length === 0 ? (
              <p className="text-[14px] font-roboto text-[#757575]">
                No service history available.
              </p>
            ) : (
              <div className="space-y-4">
                {serviceHistory.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white p-6 rounded-lg shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-[20px] font-roboto font-medium text-[#212121]">
                          {service.type}
                        </h2>
                        <p className="text-[14px] font-roboto text-[#757575]">
                          {service.date}
                        </p>
                      </div>
                      <span className="text-[#1BA0E2] font-roboto font-medium text-[16px]">
                        ${service.cost}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showServiceModal && selectedService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[20px] font-roboto font-medium text-[#212121]">
                  {selectedService.name}
                </h3>
                <button onClick={() => setShowServiceModal(false)}>
                  <i className="fas fa-times text-[#757575] hover:text-[#212121]"></i>
                </button>
              </div>
              <div className="space-y-6">
                {selectedService.name === "Oil Change" ? (
                  <div>
                    <p className="font-roboto text-[14px] text-[#757575] mb-4">
                      Choose your service provider:
                    </p>
                    <div className="space-y-4">
                      <button
                        className="w-full bg-white border-2 border-[#1E3A8A] text-[#1E3A8A] py-3 rounded-lg hover:bg-[#1E3A8A] hover:text-white font-roboto font-medium text-[16px] transition-colors"
                        onClick={() => {
                          setShowOilOptions(true);
                          setShowServiceModal(false);
                        }}
                      >
                        Independent Mechanic
                      </button>
                      <button
                        className="w-full bg-white border-2 border-[#1E3A8A] text-[#1E3A8A] py-3 rounded-lg hover:bg-[#1E3A8A] hover:text-white font-roboto font-medium text-[16px] transition-colors"
                        onClick={handleAutoShopSelection}
                      >
                        Independent Auto Shop
                      </button>
                      <button
                        className="w-full bg-white border-2 border-[#1E3A8A] text-[#1E3A8A] py-3 rounded-lg hover:bg-[#1E3A8A] hover:text-white font-roboto font-medium text-[16px] transition-colors"
                        onClick={() => {
                          setShowDealerships(true);
                          setShowServiceModal(false);
                        }}
                      >
                        Dealership
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-roboto text-[14px] text-[#757575]">
                      Book this service and a professional mechanic will come to
                      your location.
                    </p>
                    <button
                      className="w-full bg-[#1E3A8A] text-white py-3 rounded-lg hover:bg-[#1B2F66] font-roboto font-medium text-[16px]"
                      onClick={() => setShowServiceModal(false)}
                    >
                      Continue Booking
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showOilOptions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[20px] font-roboto font-medium text-[#212121]">
                  Select Oil Type
                </h3>
                <button onClick={() => setShowOilOptions(false)}>
                  <i className="fas fa-times text-[#757575] hover:text-[#212121]"></i>
                </button>
              </div>
              <div className="space-y-6">
                {oilTypes.map((oil) => (
                  <div
                    key={oil.id}
                    className="border border-[#E9ECEF] p-6 rounded-lg hover:border-[#1E3A8A] transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="font-roboto text-[20px] text-[#212121]">
                          {oil.name}
                        </h2>
                        {oil.description && (
                          <p className="text-[14px] text-[#757575] mt-2">
                            {oil.description}
                          </p>
                        )}
                      </div>
                      {oil.price !== "TBD" && (
                        <span className="text-[#1E3A8A] font-roboto text-[16px]">
                          ${oil.price}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      {oil.amazonLink ? (
                        <>
                          <a
                            href={oil.amazonLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center px-4 py-2 border border-[#1E3A8A] text-[#1E3A8A] rounded font-roboto text-[16px]"
                          >
                            Buy on Amazon
                          </a>
                          <button
                            onClick={() => {
                              setSelectedOil(oil);
                              setShowOilOptions(false);
                              setShowMechanicOptions(true);
                            }}
                            className="flex-1 bg-[#1E3A8A] text-white px-4 py-2 rounded font-roboto text-[16px]"
                          >
                            Add to Service
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            if (oil.id === 0) {
                              setShowConfirmationModal(true);
                            } else {
                              setSelectedOil(oil);
                              setShowOilOptions(false);
                              setShowMechanicOptions(true);
                            }
                          }}
                          className="w-full bg-[#1E3A8A] text-white px-4 py-2 rounded font-roboto text-[16px]"
                        >
                          Continue
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showConfirmationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[20px] font-roboto font-medium text-[#212121]">
                  Mechanic Recommendation
                </h3>
              </div>
              <p className="text-[16px] text-[#4B5563] font-roboto mb-6">
                Once you schedule your appointment, your mechanic will message
                you with options. Your final invoice will reflect the price that
                you agree upon with the mechanic.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowConfirmationModal(false);
                    setShowOilOptions(false);
                    setShowMechanicOptions(true);
                  }}
                  className="flex-1 bg-[#1E3A8A] text-white px-4 py-2 rounded font-roboto text-[16px]"
                >
                  Makes sense! Let's go
                </button>
                <button
                  onClick={() => {
                    setShowConfirmationModal(false);
                  }}
                  className="flex-1 border border-[#1E3A8A] text-[#1E3A8A] px-4 py-2 rounded font-roboto text-[16px]"
                >
                  Take me back
                </button>
              </div>
            </div>
          </div>
        )}

        {showMechanicOptions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[20px] font-roboto font-medium text-[#212121]">
                  Choose Your Preference
                </h3>
                <button onClick={() => setShowMechanicOptions(false)}>
                  <i className="fas fa-times text-[#757575] hover:text-[#212121]"></i>
                </button>
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setShowMechanicOptions(false);
                    setShowCheckout(true);
                  }}
                  className="w-full bg-white border-2 border-[#1E3A8A] text-[#1E3A8A] py-3 rounded-lg hover:bg-[#1E3A8A] hover:text-white font-roboto font-medium text-[16px] transition-colors"
                >
                  Set a time and a qualified mechanic will be in touch
                </button>
                <button
                  onClick={() => {
                    setShowMechanicOptions(false);
                    setShowMechanicList(true);
                  }}
                  className="w-full bg-white border-2 border-[#1E3A8A] text-[#1E3A8A] py-3 rounded-lg hover:bg-[#1E3A8A] hover:text-white font-roboto font-medium text-[16px] transition-colors"
                >
                  Select a qualified mechanic
                </button>
              </div>
            </div>
          </div>
        )}

        {showMechanicList && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 max-w-4xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[20px] font-roboto font-medium text-[#212121]">
                  Select a Mechanic
                </h3>
                <button onClick={() => setShowMechanicList(false)}>
                  <i className="fas fa-times text-[#757575] hover:text-[#212121]"></i>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <select
                  value={filterDistance}
                  onChange={(e) => setFilterDistance(e.target.value)}
                  className="p-2 border border-[#E9ECEF] rounded-lg"
                >
                  <option value="">Filter by Distance</option>
                  <option value="5">Within 5 miles</option>
                  <option value="10">Within 10 miles</option>
                  <option value="20">Within 20 miles</option>
                </select>
                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="p-2 border border-[#E9ECEF] rounded-lg"
                >
                  <option value="">Filter by Rating</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="3.5">3.5+ Stars</option>
                </select>
                <select
                  value={filterAvailability}
                  onChange={(e) => setFilterAvailability(e.target.value)}
                  className="p-2 border border-[#E9ECEF] rounded-lg"
                >
                  <option value="">Filter by Availability</option>
                  <option value="today">Available Today</option>
                  <option value="tomorrow">Available Tomorrow</option>
                  <option value="week">Available This Week</option>
                </select>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {mechanics.map((mechanic) => (
                  <div
                    key={mechanic.id}
                    className="border border-[#E9ECEF] p-6 rounded-lg"
                  >
                    <div className="flex justify-between">
                      <div>
                        <h4 className="font-roboto text-[18px] text-[#212121]">
                          {mechanic.name}
                        </h4>
                        <p className="text-[14px] text-[#757575] mt-1">
                          {mechanic.bio}
                        </p>
                        <div className="flex items-center mt-2">
                          <span className="text-[#FFD700]">
                            <i className="fas fa-star"></i> {mechanic.rating}
                          </span>
                          <span className="mx-2 text-[#757575]">•</span>
                          <span className="text-[#757575]">
                            {mechanic.reviews} reviews
                          </span>
                          <span className="mx-2 text-[#757575]">•</span>
                          <span className="text-[#757575]">
                            {mechanic.distance} miles away
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h5 className="font-roboto text-[16px] text-[#212121] mb-2">
                        Available Times:
                      </h5>
                      <div className="grid grid-cols-3 gap-2">
                        {mechanic.availableTimes.map((time) => (
                          <button
                            key={time}
                            onClick={() => {
                              setSelectedMechanic(mechanic);
                              setSelectedTime(time);
                              setShowMechanicList(false);
                              setShowCheckout(true);
                            }}
                            className="py-2 px-3 text-[14px] border border-[#E9ECEF] rounded hover:border-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white transition-colors"
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAutoShops && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[20px] font-roboto font-medium text-[#212121]">
                  Select Auto Shop
                </h3>
                <button onClick={() => setShowAutoShops(false)}>
                  <i className="fas fa-times text-[#757575] hover:text-[#212121]"></i>
                </button>
              </div>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by location..."
                  className="w-full p-3 border border-[#E9ECEF] rounded-lg font-roboto text-[16px]"
                />
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {autoShops.map((shop) => (
                  <div
                    key={shop.id}
                    className="border border-[#E9ECEF] p-4 rounded-lg hover:border-[#1E3A8A] transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-roboto text-[18px] text-[#212121]">
                          {shop.name}
                        </h4>
                        <p className="text-[14px] text-[#757575] mt-1">
                          {shop.address}
                        </p>
                        <p className="text-[14px] text-[#757575]">
                          {shop.distance} miles away
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#1E3A8A] font-roboto font-medium">
                          ${shop.price}
                        </p>
                        <p className="text-[14px] text-[#757575]">
                          {shop.availability}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-4">
                        <h5 className="font-roboto text-[16px] text-[#212121] mb-2">
                          Available Times Today:
                        </h5>
                        <div className="grid grid-cols-3 gap-2">
                          {shop.availableTimes.map((time) => (
                            <button
                              key={time}
                              className="py-2 px-3 text-[14px] border border-[#E9ECEF] rounded hover:border-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white transition-colors"
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedShop(shop);
                          setShowAutoShops(false);
                          setShowCheckout(true);
                        }}
                        className="w-full bg-[#1E3A8A] text-white py-2 rounded font-roboto text-[16px]"
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-[#1E3A8A] py-12 mt-24">
        <div className="container mx-auto px-4 text-center">
          <p className="font-roboto text-[12px] text-white/80">
            © 2024 Mobile Mechanic. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default MainComponent;