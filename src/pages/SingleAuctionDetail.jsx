import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { getSingleAuctionById, reset } from "../store/auction/auctionSlice";
import CountDownTimer from "../components/CountDownTimer";
import BidCard from "../components/BidCard";
import { placeABid } from "../store/bid/bidSlice";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { sendNewBidNotification } from "../store/notification/notificationSlice";
import socket from "../socket";
import { getAllBidsForAuction } from "../store/bid/bidSlice";
import Loading from "../components/Loading";

const SingleAuctionDetail = ({ noPadding }) => {
  const [newBidAmount, setNewBidAmount] = useState("");
  const [activeTab, setActiveTab] = useState("description");
  const [auctionStarted, setAuctionStarted] = useState(false);
  const [singleAuctionData, setSingleAuctionData] = useState();
  const [auctionWinnerDetailData, setAuctionWinnerDetailData] = useState();
  const [bidsData, setBidsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const logInUser = JSON.parse(localStorage.getItem("user"));
  const { user } = useSelector((state) => state.auth);
  const { singleAuction } = useSelector((state) => state.auction);
  const { bids } = useSelector((state) => state.bid);
  
  const params = useParams();
  const dispatch = useDispatch();

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = new Date().getTime();
      const auctionStartTime = new Date(singleAuction?.startTime).getTime();
      const auctionEndTime = new Date(singleAuction?.endTime).getTime();

      if (currentTime >= auctionStartTime && currentTime <= auctionEndTime && !auctionStarted) {
        setAuctionStarted(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [singleAuction?.startTime, singleAuction?.endTime, auctionStarted]);

  useEffect(() => {
    socket.on("winnerSelected", (data) => {
      setAuctionStarted(false);
      setAuctionWinnerDetailData(data);
    });

    socket.on("newBidData", (data) => {
      setBidsData((prevBids) => [
        {
          _id: new Date().getTime(),
          bidder: { fullName: data.fullName, profilePicture: data.profilePicture },
          bidAmount: data.bidAmount,
          bidTime: data.bidTime,
          auction: data.auctionId,
        },
        ...prevBids,
      ]);
      setSingleAuctionData((prevState) => ({
        ...prevState,
        startingPrice: data.bidAmount,
      }));
    });

    return () => {
      socket.off("winnerSelected");
      socket.off("newBidData");
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    dispatch(getSingleAuctionById(params.id)).finally(() => setIsLoading(false));
    dispatch(getAllBidsForAuction(params.id));
  }, [params.id, dispatch]);

  useEffect(() => {
    setBidsData(bids);
    setSingleAuctionData(singleAuction);
  }, [bids, singleAuction]);

  useEffect(() => {
    socket.on("connect", () => {
      console.log(`Client connected with the id: ${socket.id}`);
    });
    socket.emit("joinAuction", logInUser?._id);
  }, [logInUser?._id]);

  const placeBidHandle = async (e) => {
    e.preventDefault();
    if (user?.paymentVerified === false) {
      return toast.info("Please verify your payment method to place a bid.");
    }

    if (Math.floor(newBidAmount) <= singleAuctionData?.startingPrice) {
      return toast.info("Bid amount should be greater than the current bid.");
    } else if (singleAuction?.endTime < new Date().getTime() / 1000) {
      return toast.info("Auction time is over.");
    }

    const bidData = {
      id: params.id,
      amount: Math.floor(newBidAmount),
    };

    dispatch(placeABid(bidData));
    setNewBidAmount("");

    socket.emit("newBid", {
      profilePicture: logInUser?.profilePicture,
      fullName: logInUser?.fullName,
      bidAmount: Math.floor(newBidAmount),
      bidTime: new Date().getTime(),
      auctionId: params.id,
    });

    await socket.emit("sendNewBidNotification", {
      auctionId: params.id,
      type: "BID_PLACED",
      newBidAmount,
      fullName: logInUser?.fullName,
      id: logInUser?._id,
    });

    setActiveTab("bids");
    dispatch(
      sendNewBidNotification({
        auctionId: params.id,
        type: "BID_PLACED",
        newBidAmount,
      })
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className={`flex place-content-between py-10 px-5 lg:py-20 lg:px-10 items-start gap-7 flex-wrap md:flex-nowrap ${noPadding ? "lg:py-0 px-0" : "p-4"}`} id="item01">
      <img className="rounded-xl md:max-w-[45%] w-full" src={singleAuction?.image} alt="product image" />
      <div className="w-full flex gap-4 flex-col">
        <div>
          <h2 className="text-3xl font-extrabold text-white">{singleAuction?.name}</h2>
          <div className="pt-4 flex flex-row gap-4 flex-wrap text-body-text-color capitalize">
            <a href="#" className="px-4 py-1 border rounded-full hover:bg-color-primary border-border-info-color hover:text-white transition-all">
              {singleAuction?.category?.name}
            </a>
            <a href="#" className="px-4 py-1 border rounded-full hover:bg-color-primary border-border-info-color hover:text-white transition-all">
              {singleAuction?.location?.name}
            </a>
          </div>
        </div>

        <div className="pt-4 border-t border-border-info-color">
          <div className="flex gap-8">
            <div id="author-item" className="text-heading-color">
              <span className="font-medium capitalize">Seller</span>
              <div id="author-info" className="flex items-center gap-2 pt-2">
                <img src={singleAuction?.seller?.profilePicture} alt="avatar" className="w-[45px] rounded-full" />
                <a href="#" className="font-medium">{singleAuction?.seller?.fullName}</a>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 font-bold text-white">
            <button
              className={`px-5 py-2 rounded-xl ${activeTab === "description" ? "bg-color-primary" : "bg-theme-bg2 text-body-text-color"}`}
              onClick={() => setActiveTab("description")}
            >
              Details
            </button>
            <button
              className={`px-5 py-2 rounded-xl ${activeTab === "bids" ? "bg-color-primary" : "bg-theme-bg2 text-body-text-color"}`}
              onClick={() => setActiveTab("bids")}
            >
              Bids
            </button>
          </div>
        </div>

        <div id="description" className={`pt-4 border-t border-border-info-color ${activeTab === "description" ? "block" : "hidden"}`}>
          <h3 className="text-heading-color font-medium">Description</h3>
          <p className="text-body-text-color">{singleAuction?.description}</p>
        </div>

        <div id="bids" className={`pt-4 border-t border-border-info-color max-h-[250px] overflow-y-auto ${activeTab === "bids" ? "block" : "hidden"} no-scrollbar`}>
          {bidsData.length > 0 ? (
            bidsData.map((bid) => <BidCard key={bid._id} bid={bid} />)
          ) : (
            <h1 className="text-white">No bids yet</h1>
          )}
        </div>

        <div className="flex flex-col gap-4 pt-4 border-t border-border-info-color">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-2">
              <h3 className="text-heading-color font-medium">{singleAuction?.bids?.length > 0 ? "Current Bid" : "Starting Price"}</h3>
              <p className="text-body-text-color">${singleAuctionData?.startingPrice}</p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-heading-color font-medium">Time</h3>
              <CountDownTimer startTime={singleAuction?.startTime} endTime={singleAuction?.endTime} />
            </div>
          </div>

          {auctionStarted && (
            <form onSubmit={placeBidHandle} className="flex gap-4 w-full">
              <input
                type="number"
                placeholder="Enter bid amount"
                value={newBidAmount}
                onChange={(e) => setNewBidAmount(e.target.value)}
                className="px-4 py-2 text-heading-color w-full bg-theme-bg2 rounded-lg border border-border-info-color focus:outline-none"
                required
              />
              <button type="submit" className="px-4 py-2 text-heading-color bg-color-primary rounded-lg hover:bg-color-primary-dark transition-all">
                Place Bid
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SingleAuctionDetail;
